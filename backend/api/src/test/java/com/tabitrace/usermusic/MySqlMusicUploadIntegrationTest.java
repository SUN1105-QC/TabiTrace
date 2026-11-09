package com.tabitrace.usermusic;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.usermusic.dto.UserMusicDtos.UploadUrlRequest;
import com.tabitrace.usermusic.mapper.UserMusicMapper;
import com.tabitrace.usermusic.service.UserMusicProperties;
import com.tabitrace.usermusic.service.UserMusicService;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real MySQL tests restricted to new random-prefixed tables on a loopback test connection. */
@EnabledIfEnvironmentVariable(named = "PAYMENT_TEST_DB_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MySqlMusicUploadIntegrationTest {
    private static final List<String> TABLES = List.of("users", "memberships", "user_music");
    private static final long MIB = 1024L * 1024;
    private final String prefix = "musictest_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "_";
    private JdbcTemplate jdbc;
    private AnnotationConfigApplicationContext context;
    private UserMusicService service;
    private UserMusicMapper mapper;
    private StorageService storage;
    private final ThreadLocal<List<String>> statements = new ThreadLocal<>();

    private String table(String name) {
        if (!TABLES.contains(name) || !prefix.matches("musictest_[a-f0-9]{12}_")) throw new IllegalStateException("Invalid test table");
        return prefix + name;
    }

    private String sql(String source) {
        for (String name : TABLES) source = source.replaceAll("\\b" + name + "\\b", table(name));
        source = source.replaceAll("\\b((?:fk_|idx_|uk_)[a-zA-Z0-9_]+)\\b", prefix + "$1");
        var references = Pattern.compile("(?i)\\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE)\\s+([a-zA-Z_][a-zA-Z0-9_]*)").matcher(source);
        while (references.find()) {
            String reference = references.group(1);
            if (TABLES.stream().noneMatch(name -> table(name).equals(reference)))
                throw new IllegalStateException("Statement escaped test tables: " + reference);
        }
        return source;
    }

    @BeforeAll void start() throws Exception {
        String url = System.getenv("PAYMENT_TEST_DB_URL");
        if (!url.matches("jdbc:mysql://(?:127\\.0\\.0\\.1|localhost)(?::[0-9]+)?/[^/?]+(?:\\?.*)?"))
            throw new IllegalArgumentException("Music integration tests only allow explicit loopback MySQL connections");
        var ds = new DriverManagerDataSource(url, System.getenv().getOrDefault("PAYMENT_TEST_DB_USER", "tabitrace_app"),
                System.getenv("PAYMENT_TEST_DB_PASSWORD"));
        jdbc = new JdbcTemplate(ds);
        try {
            jdbc.execute(sql("CREATE TABLE users(id BIGINT PRIMARY KEY) ENGINE=InnoDB"));
            jdbc.execute(sql("""
                    CREATE TABLE memberships(id BIGINT PRIMARY KEY AUTO_INCREMENT,user_id BIGINT NOT NULL,plan VARCHAR(20),
                      source VARCHAR(20),status VARCHAR(20),started_at DATETIME(6),expires_at DATETIME(6),payment_id BIGINT NULL,
                      created_at DATETIME(6),updated_at DATETIME(6),
                      CONSTRAINT fk_music_test_member_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)
                    ENGINE=InnoDB
                    """));
            String migration = Files.readString(Path.of(System.getProperty("basedir"), "src/main/resources/db/migration/V15__membership_user_music.sql"));
            var definition = Pattern.compile("CREATE TABLE user_music \\(.*?ENGINE=.*?;", Pattern.DOTALL).matcher(migration);
            assertTrue(definition.find());
            jdbc.execute(sql(definition.group().replaceAll("(?m)--[^\\r\\n]*", "")));

            var factory = new SqlSessionFactoryBean(); factory.setDataSource(ds); factory.setPlugins(new PrefixSql(this));
            var config = new org.apache.ibatis.session.Configuration(); config.setMapUnderscoreToCamelCase(true);
            config.addMapper(UserMusicMapper.class); config.addMapper(MembershipMapper.class); factory.setConfiguration(config);
            var template = new SqlSessionTemplate(Objects.requireNonNull(factory.getObject()));
            mapper = template.getMapper(UserMusicMapper.class); storage = mock(StorageService.class);
            context = new AnnotationConfigApplicationContext();
            context.registerBean(DataSource.class, () -> ds);
            context.registerBean(UserMusicMapper.class, () -> mapper);
            context.registerBean(MembershipMapper.class, () -> template.getMapper(MembershipMapper.class));
            context.registerBean(StorageService.class, () -> storage);
            context.registerBean(UserMusicProperties.class, UserMusicProperties::defaults);
            context.register(Transactions.class, MembershipService.class, UserMusicService.class);
            context.refresh(); service = context.getBean(UserMusicService.class);
        } catch (Exception | AssertionError ex) { cleanup(); throw ex; }
    }

    @Configuration @EnableTransactionManagement
    static class Transactions {
        @Bean PlatformTransactionManager transactionManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
    }

    @Intercepts(@Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class}))
    static class PrefixSql implements Interceptor {
        private final MySqlMusicUploadIntegrationTest test;
        PrefixSql(MySqlMusicUploadIntegrationTest test) { this.test = test; }
        public Object intercept(Invocation invocation) throws Throwable {
            var statement = (StatementHandler) invocation.getTarget();
            String query = test.sql(statement.getBoundSql().getSql());
            var capture = test.statements.get(); if (capture != null) capture.add(query);
            SystemMetaObject.forObject(statement.getBoundSql()).setValue("sql", query);
            return invocation.proceed();
        }
    }

    @AfterAll void cleanup() {
        if (context != null) context.close();
        if (jdbc != null) for (String name : List.of("user_music", "memberships", "users"))
            jdbc.execute("DROP TABLE IF EXISTS " + table(name));
    }

    @BeforeEach void reset() {
        for (String name : List.of("user_music", "memberships", "users")) jdbc.update("DELETE FROM " + table(name));
        org.mockito.Mockito.reset(storage);
        when(storage.presignKey(anyString(), anyString(), anyLong())).thenAnswer(i ->
                new PresignResponse(i.getArgument(0), "https://uploads.example.invalid", null, 900, false));
        member(1, true); member(2, true);
    }

    private void member(long user, boolean active) {
        jdbc.update(sql("INSERT INTO users(id) VALUES(?)"), user);
        if (active) jdbc.update(sql("""
                INSERT INTO memberships(user_id,plan,source,status,started_at,created_at,updated_at)
                VALUES(?,'MEMBER','GRANT','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())
                """), user);
    }

    private void seed(int count, long size) {
        for (int i = 0; i < count; i++) jdbc.update(sql("""
                INSERT INTO user_music(user_id,title,original_filename,storage_key,mime_type,file_size,status,
                  copyright_confirmed,copyright_confirmed_at,created_at,updated_at)
                VALUES(1,'fixture','fixture.mp3',?,'audio/mpeg',?,'READY',TRUE,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())
                """), "user-music/1/fixture-" + i + ".mp3", size);
    }

    private UploadUrlRequest request(long size) { return new UploadUrlRequest("song.mp3", "audio/mpeg", size, "song", true); }
    private long rows() { return jdbc.queryForObject("SELECT COUNT(*) FROM " + table("user_music"), Long.class); }

    private List<String> concurrentUploads(long size, int count) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(count)) {
            List<Future<String>> results = new ArrayList<>();
            for (int i = 0; i < count; i++) results.add(pool.submit(() -> {
                assertTrue(gate.await(10, TimeUnit.SECONDS));
                try { service.uploadUrl(1L, request(size)); return "OK"; }
                catch (BusinessException ex) { return ex.getCode(); }
            }));
            gate.countDown();
            List<String> values = new ArrayList<>();
            for (var result : results) values.add(result.get(15, TimeUnit.SECONDS));
            return values;
        }
    }

    @Test void concurrentUploadsCannotExceedTwentyTracks() throws Exception {
        seed(19, 1);
        var results = concurrentUploads(1024, 8);
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(7, Collections.frequency(results, "USER_MUSIC_LIMIT"));
        assertEquals(20, rows());
        assertEquals(20, service.library(1L).usage().tracks());
    }

    @Test void concurrentUploadsCannotOverReserveFiveHundredMiB() throws Exception {
        seed(16, 30 * MIB);
        var results = concurrentUploads(15 * MIB, 8);
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(7, Collections.frequency(results, "USER_MUSIC_STORAGE_FULL"));
        assertEquals(17, rows());
        assertEquals(495 * MIB, service.library(1L).usage().bytes());
    }

    @Test void exactCapacityBoundaryWorksAndRejectedRequestReservesNothing() {
        seed(16, 30 * MIB);
        service.uploadUrl(1L, request(20 * MIB));
        assertEquals(500 * MIB, service.library(1L).usage().bytes());
        var error = assertThrows(BusinessException.class, () -> service.uploadUrl(1L, request(1)));
        assertEquals("USER_MUSIC_STORAGE_FULL", error.getCode()); assertEquals(17, rows());
    }

    @Test void signingFailureRollsBackInsertedReservationAndAllowsRetry() {
        doThrow(new IllegalStateException("simulated signer failure")).when(storage).presignKey(anyString(), anyString(), anyLong());
        assertThrows(IllegalStateException.class, () -> service.uploadUrl(1L, request(1024)));
        assertEquals(0, rows()); assertEquals(0, service.library(1L).usage().bytes());
        org.mockito.Mockito.reset(storage);
        when(storage.presignKey(anyString(), anyString(), anyLong())).thenAnswer(i ->
                new PresignResponse(i.getArgument(0), "https://uploads.example.invalid", null, 900, false));
        service.uploadUrl(1L, request(1024));
        assertEquals(1, rows()); assertEquals(1024, service.library(1L).usage().bytes());
    }

    @Test void membershipAndCopyrightChecksRemainMandatory() {
        member(3, false);
        var none = assertThrows(BusinessException.class, () -> service.uploadUrl(3L, request(1024)));
        assertEquals("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", none.getCode());
        jdbc.update(sql("UPDATE memberships SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE user_id=2"));
        var expired = assertThrows(BusinessException.class, () -> service.uploadUrl(2L, request(1024)));
        assertEquals("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", expired.getCode());
        var copyright = assertThrows(BusinessException.class, () -> service.uploadUrl(1L,
                new UploadUrlRequest("song.mp3", "audio/mpeg", 1024L, "song", false)));
        assertEquals("COPYRIGHT_CONFIRMATION_REQUIRED", copyright.getCode());
        assertEquals(0, rows()); verifyNoInteractions(storage);
    }

    @Test void lockIsFirstDatabaseReadAndReservationRunsInReadCommittedTransaction() {
        List<String> observed = new ArrayList<>(); statements.set(observed);
        try {
            when(storage.presignKey(anyString(), anyString(), anyLong())).thenAnswer(i -> {
                assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
                assertEquals(Connection.TRANSACTION_READ_COMMITTED, TransactionSynchronizationManager.getCurrentTransactionIsolationLevel());
                return new PresignResponse(i.getArgument(0), "https://uploads.example.invalid", null, 900, false);
            });
            service.uploadUrl(1L, request(1024));
            assertTrue(observed.getFirst().contains("FROM " + table("users")) && observed.getFirst().contains("FOR UPDATE"), observed.toString());
            assertTrue(observed.get(1).contains("FROM " + table("memberships")), observed.toString());
        } finally { statements.remove(); }
    }

    @Test void oneAccountReservationDoesNotBlockAnotherAccount() throws Exception {
        CountDownLatch signing = new CountDownLatch(1), release = new CountDownLatch(1);
        when(storage.presignKey(startsWith("user-music/1/"), anyString(), anyLong())).thenAnswer(i -> {
            signing.countDown(); assertTrue(release.await(10, TimeUnit.SECONDS));
            return new PresignResponse(i.getArgument(0), "https://uploads.example.invalid", null, 900, false);
        });
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> service.uploadUrl(1L, request(1024)));
            try {
                assertTrue(signing.await(10, TimeUnit.SECONDS));
                var second = pool.submit(() -> service.uploadUrl(2L, request(2048)));
                assertEquals(2048, second.get(5, TimeUnit.SECONDS).music().fileSize());
                assertFalse(first.isDone());
            } finally { release.countDown(); }
            first.get(10, TimeUnit.SECONDS);
        }
        assertEquals(2, rows());
    }
}
