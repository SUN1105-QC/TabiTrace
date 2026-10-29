package com.tabitrace.payment;

import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.payment.service.PaymentTransactions;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.payment.service.StripeGateway;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.cost.*;
import com.tabitrace.video.mapper.VideoProjectMapper;
import com.tabitrace.video.service.VideoService;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripDeletionService;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.user.service.AccountDeletionService;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.photo.mapper.PhotoMapper;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import javax.sql.DataSource;
import java.nio.file.*;
import java.sql.Connection;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Opt-in real MySQL tests. Every statement is restricted to fresh random-prefixed test tables. */
@EnabledIfEnvironmentVariable(named="PAYMENT_TEST_DB_URL", matches=".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MySqlPaymentIntegrationTest {
    static final List<String> TABLES=List.of("users","trips","payments","memberships","payment_events","video_projects","photos","user_music","cost_control_locks","render_usage_daily","cost_alerts","video_output_deletions");
    String prefix="paytest_"+UUID.randomUUID().toString().replace("-", "").substring(0,12)+"_";
    JdbcTemplate jdbc;
    AnnotationConfigApplicationContext ctx;
    PaymentMapper mapper;
    com.tabitrace.user.mapper.AccountMapper account;
    PaymentTransactions tx;
    CostMapper costMapper;
    CostProperties costProps=new CostProperties();
    CostControlService costs;
    VideoProjectMapper videos;
    VideoService videoService;
    TripDeletionService tripDeletion;
    AccountDeletionService accountDeletion;
    StorageService storage=mock(StorageService.class);
    TripService tripMock;
    ObjectMapper json=new ObjectMapper();

    String sql(String text) {
        if (!prefix.matches("paytest_[a-f0-9]{12}_")) throw new IllegalStateException("Unsafe test prefix");
        for (String table:TABLES) text=text.replaceAll("\\b"+table+"\\b",prefix+table);
        return text.replaceAll("\\b((?:fk_|idx_|uk_)[a-zA-Z0-9_]+)\\b",prefix+"$1");
    }
    void execute(String text) {
        text=text.replaceAll("(?m)--[^\\r\\n]*", "");
        for(String statement:text.split(";")) if (!statement.isBlank()) jdbc.execute(sql(statement));
    }
    String read(String name) throws Exception {
        return Files.readString(Path.of(System.getProperty("basedir"),"src/main/resources/db/migration",name));
    }
    String table(String script,String name) {
        Matcher m=Pattern.compile("CREATE TABLE "+name+" \\(.*?ENGINE=.*?;",Pattern.DOTALL).matcher(script);
        if (!m.find()) throw new IllegalStateException("Missing table "+name);
        return m.group();
    }

    @BeforeAll void start() throws Exception {
        DriverManagerDataSource ds=new DriverManagerDataSource(System.getenv("PAYMENT_TEST_DB_URL"),
                System.getenv().getOrDefault("PAYMENT_TEST_DB_USER","tabitrace_app"),System.getenv("PAYMENT_TEST_DB_PASSWORD"));
        jdbc=new JdbcTemplate(ds);
        try {
            String v1=read("V1__initial_schema.sql");
            for(String t:List.of("users","trips","payments")) execute(table(v1,t));
            execute(read("V13__lifetime_pro.sql"));
            execute(table(read("V15__membership_user_music.sql"),"memberships"));
            String v17=read("V17__account_deletion_sessions.sql");
            execute(v17.substring(0,v17.indexOf("-- 登录会话编号")));
            execute(v17.substring(v17.indexOf("ALTER TABLE payments")));
            // A legacy manual grant and a legacy paid entitlement must be distinguished during migration.
            user(11); user(12); trip(11,11,"PRO"); trip(12,12,"PRO");
            execute("INSERT INTO payments(user_id,trip_id,product,provider,amount,currency,status,paid_at,created_at,updated_at) VALUES(12,12,'TRIP_PRO','MOCK',400,'CNY','PAID',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())");
            user(13); trip(13,13,"PRO");
            execute("UPDATE users SET lifetime_pro_at=UTC_TIMESTAMP() WHERE id=13");
            execute("INSERT INTO payments(user_id,trip_id,product,provider,amount,currency,status,paid_at,created_at,updated_at) VALUES(13,NULL,'LIFETIME','MOCK',100000,'CNY','PAID',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())");
            execute(read("V20__payment_lifecycle.sql"));
            assertEquals(1,jdbc.queryForObject(sql("SELECT pro_grant FROM trips WHERE id=11"),Integer.class));
            assertEquals(0,jdbc.queryForObject(sql("SELECT pro_grant FROM trips WHERE id=12"),Integer.class));
            assertEquals(1,jdbc.queryForObject(sql("SELECT pro_grant FROM trips WHERE id=13"),Integer.class));
            execute(table(v1,"video_projects"));
            String v3=read("V3__travel_story.sql");execute(v3.substring(0,v3.indexOf("-- 已有项目")));
            // Query fixtures: only the columns read by storage observation are needed here.
            execute("CREATE TABLE photos(id BIGINT PRIMARY KEY,user_id BIGINT,file_size BIGINT NULL,thumb_key VARCHAR(255) NULL,medium_key VARCHAR(255) NULL)");
            execute(table(read("V15__membership_user_music.sql"),"user_music"));
            execute(read("V21__cost_observability.sql"));
            execute(read("V22__video_output_deletions.sql"));

            SqlSessionFactoryBean factory=new SqlSessionFactoryBean(); factory.setDataSource(ds);
            factory.setPlugins(new PrefixSql(this));
            org.apache.ibatis.session.Configuration config=new org.apache.ibatis.session.Configuration();
            config.setMapUnderscoreToCamelCase(true); config.addMapper(PaymentMapper.class); config.addMapper(MembershipMapper.class);
            config.addMapper(com.tabitrace.user.mapper.AccountMapper.class);
            config.addMapper(CostMapper.class);
            config.addMapper(VideoProjectMapper.class);config.addMapper(TripMapper.class);config.addMapper(UserMapper.class);
            factory.setConfiguration(config);
            SqlSessionTemplate template=new SqlSessionTemplate(Objects.requireNonNull(factory.getObject()));
            mapper=template.getMapper(PaymentMapper.class);
            account=template.getMapper(com.tabitrace.user.mapper.AccountMapper.class);
            costMapper=template.getMapper(CostMapper.class);
            videos=template.getMapper(VideoProjectMapper.class);
            TripService trips=mock(TripService.class);
            tripMock=trips;
            when(trips.requireOwned(anyLong(),anyLong())).thenAnswer(i->{
                Long uid=i.getArgument(0), tid=i.getArgument(1);
                return jdbc.queryForObject(sql("SELECT id,user_id,plan_type FROM trips WHERE id=? AND user_id=?"),(rs,n)->{
                    TripEntity t=new TripEntity(); t.id=rs.getLong("id"); t.userId=rs.getLong("user_id"); t.planType=rs.getString("plan_type"); return t;
                },tid,uid);
            });
            when(trips.requireWritable(anyLong(),anyLong())).thenAnswer(i->trips.requireOwned(i.getArgument(0),i.getArgument(1)));
            doAnswer(i->{Long tripId=i.getArgument(1),userId=i.getArgument(0);jdbc.update(sql("DELETE FROM trips WHERE id=? AND user_id=?"),tripId,userId);return null;})
                    .when(trips).delete(anyLong(),anyLong());
            ctx=new AnnotationConfigApplicationContext();
            ctx.registerBean(DataSource.class,()->ds); ctx.registerBean(PaymentMapper.class,()->mapper);
            ctx.registerBean(TripService.class,()->trips);
            ctx.registerBean(MembershipService.class,()->new MembershipService(template.getMapper(MembershipMapper.class)));
            ctx.registerBean(CostMapper.class,()->costMapper);ctx.registerBean(CostProperties.class,()->costProps);
            ctx.register(CostControlService.class);
            ctx.registerBean(VideoService.class,()->new VideoService(videos,null,null,trips,null,null,json,storage));
            ctx.registerBean(TripDeletionService.class,()->new TripDeletionService(trips,mock(PhotoMapper.class),storage,template.getMapper(TripMapper.class),videos));
            ctx.registerBean(AccountDeletionService.class,()->new AccountDeletionService(template.getMapper(UserMapper.class),
                    mock(com.tabitrace.auth.mapper.RefreshTokenMapper.class),mock(org.springframework.security.crypto.password.PasswordEncoder.class),
                    storage,videos,ctx.getBean(PlatformTransactionManager.class)));
            ctx.register(TxConfig.class,PaymentTransactions.class); ctx.refresh(); tx=ctx.getBean(PaymentTransactions.class);
            costs=ctx.getBean(CostControlService.class);
            videoService=ctx.getBean(VideoService.class);tripDeletion=ctx.getBean(TripDeletionService.class);accountDeletion=ctx.getBean(AccountDeletionService.class);
        } catch (Exception|AssertionError e) { cleanup(); throw e; }
    }

    @Configuration @EnableTransactionManagement static class TxConfig {
        @Bean PlatformTransactionManager transactionManager(DataSource ds) { return new DataSourceTransactionManager(ds); }
    }

    @Intercepts(@Signature(type=StatementHandler.class,method="prepare",args={Connection.class,Integer.class}))
    static class PrefixSql implements Interceptor {
        final MySqlPaymentIntegrationTest test;
        PrefixSql(MySqlPaymentIntegrationTest test) { this.test=test; }
        public Object intercept(Invocation invocation) throws Throwable {
            StatementHandler handler=(StatementHandler)invocation.getTarget();
            SystemMetaObject.forObject(handler.getBoundSql()).setValue("sql",test.sql(handler.getBoundSql().getSql()));
            return invocation.proceed();
        }
    }

    @AfterAll void cleanup() {
        if (ctx!=null) ctx.close();
        if (jdbc!=null) for(String t:List.of("video_output_deletions","cost_alerts","render_usage_daily","cost_control_locks","user_music","photos","video_projects","payment_events","memberships","payments","trips","users"))
            jdbc.execute("DROP TABLE IF EXISTS "+sql(t));
    }
    void user(long id) { execute("INSERT INTO users(id,email,password_hash,nickname,created_at,updated_at) VALUES("+id+",'test"+id+"@example.invalid','test-only','test',UTC_TIMESTAMP(),UTC_TIMESTAMP())"); }
    void trip(long id,long user,String plan) { execute("INSERT INTO trips(id,user_id,title,destination_name,start_date,end_date,plan_type,created_at,updated_at) VALUES("+id+","+user+",'test','Tokyo','2026-10-01','2026-10-03','"+plan+"',UTC_TIMESTAMP(),UTC_TIMESTAMP())"); }
    void video(long id,long user,long trip){execute("INSERT INTO video_projects(id,user_id,trip_id,template_code,aspect_ratio,duration,music_code,status,created_at,updated_at) VALUES("+id+","+user+","+trip+",'JOURNAL','9:16',30,'NONE','DRAFT',UTC_TIMESTAMP(),UTC_TIMESTAMP())");}
    void queueWithBudget(long user,long project){
        org.springframework.transaction.support.TransactionTemplate t=new org.springframework.transaction.support.TransactionTemplate(ctx.getBean(PlatformTransactionManager.class));
        t.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        t.executeWithoutResult(status->{costs.lockRendering(user);jdbc.update(sql("UPDATE video_projects SET status='QUEUED' WHERE id=?"),project);costs.reserveRender(user,30);});
    }
    @BeforeEach void resetCosts(){
        reset(storage);
        costProps.setEnforce(false);costProps.setAccountDailyRenders(0);costProps.setAccountDailySeconds(0);costProps.setGlobalDailyRenders(0);costProps.setGlobalDailySeconds(0);costProps.setGlobalActiveRenders(0);
        execute("DELETE FROM render_usage_daily; DELETE FROM cost_alerts; DELETE FROM video_projects; DELETE FROM video_output_deletions");
    }
    ObjectNode session(PaymentEntity p,int refund) {
        ObjectNode s=json.createObjectNode(); s.put("id","cs_test_"+p.id); s.put("mode","payment"); s.put("status","complete"); s.put("payment_status","paid"); s.put("amount_total",p.amount); s.put("currency","cny");
        ObjectNode meta=s.putObject("metadata"); meta.put("payment_id",p.id.toString()); meta.put("product",p.product); if(p.orderTripId!=null)meta.put("trip_id",p.orderTripId.toString());
        ObjectNode pi=s.putObject("payment_intent"); pi.put("id","pi_test_"+p.id); pi.put("status","succeeded");
        ObjectNode c=pi.putObject("latest_charge"); c.put("id","ch_test_"+p.id); c.put("amount",p.amount); c.put("currency","cny"); c.put("paid",true); c.put("amount_refunded",refund);
        return s;
    }

    @Test void concurrentCheckoutsPersistExactlyOneOrder() throws Exception {
        user(1); trip(1,1,"FREE");
        try(ExecutorService executor=Executors.newFixedThreadPool(8)) {
            CountDownLatch gate=new CountDownLatch(1); List<Future<Long>> results=new ArrayList<>();
            for(int i=0;i<8;i++) results.add(executor.submit(()->{gate.await();return tx.prepare(1L,1L,"TRIP_PRO",400,"STRIPE").id;}));
            gate.countDown(); Set<Long> ids=new HashSet<>(); for(Future<Long> f:results) ids.add(f.get(20,TimeUnit.SECONDS));
            assertEquals(1,ids.size()); assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM payments WHERE user_id=1"),Integer.class));
        }
    }

    @Test void concurrentDuplicateCallbacksCreateOneEventAndMembership() throws Exception {
        user(2); trip(2,2,"FREE"); PaymentEntity p=tx.prepare(2L,null,"LIFETIME",100000,"STRIPE");
        try(ExecutorService executor=Executors.newFixedThreadPool(6)) {
            List<Callable<PaymentEntity>> tasks=new ArrayList<>();
            for(int i=0;i<6;i++)tasks.add(()->tx.apply(p.id,session(p,0),null,"evt_same","checkout.session.completed"));
            for(Future<PaymentEntity> f:executor.invokeAll(tasks)) assertEquals("PAID",f.get().status);
        }
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM memberships WHERE user_id=2"),Integer.class));
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM payment_events WHERE payment_id=?"),Integer.class,p.id));
        assertEquals("PRO",jdbc.queryForObject(sql("SELECT plan_type FROM trips WHERE id=2"),String.class));
    }

    @Test void lifetimeRefundPreservesIndividualPurchasesAndManualGrants() {
        user(3); trip(3,3,"FREE"); trip(4,3,"FREE"); trip(5,3,"PRO"); execute("UPDATE trips SET pro_grant=TRUE WHERE id=5");
        PaymentEntity single=tx.prepare(3L,3L,"TRIP_PRO",400,"STRIPE"); tx.apply(single.id,session(single,0),null,null,null);
        PaymentEntity life=tx.prepare(3L,null,"LIFETIME",100000,"STRIPE"); tx.apply(life.id,session(life,0),null,null,null);
        tx.apply(life.id,session(life,100000),null,"evt_refund","charge.refunded");
        assertEquals("PRO",jdbc.queryForObject(sql("SELECT plan_type FROM trips WHERE id=3"),String.class));
        assertEquals("FREE",jdbc.queryForObject(sql("SELECT plan_type FROM trips WHERE id=4"),String.class));
        assertEquals("PRO",jdbc.queryForObject(sql("SELECT plan_type FROM trips WHERE id=5"),String.class));
        assertEquals(0,mapper.hasLifetime(3L));
        assertEquals("REVOKED",jdbc.queryForObject(sql("SELECT status FROM memberships WHERE user_id=3"),String.class));
        assertEquals(3,jdbc.queryForObject(sql("SELECT COUNT(*) FROM trips WHERE user_id=3"),Integer.class));
    }

    @Test void invalidChargeRollsBackEventReceiptAndEntitlements() {
        user(4); trip(6,4,"FREE"); PaymentEntity p=tx.prepare(4L,6L,"TRIP_PRO",400,"STRIPE");
        ObjectNode s=session(p,0); ((ObjectNode)s.path("payment_intent").path("latest_charge")).put("amount",1);
        assertThrows(RuntimeException.class,()->tx.apply(p.id,s,null,"evt_invalid","checkout.session.completed"));
        assertEquals("PENDING",mapper.findById(p.id).status);
        assertEquals(0,jdbc.queryForObject(sql("SELECT COUNT(*) FROM payment_events WHERE payment_id=?"),Integer.class,p.id));
        assertEquals("FREE",jdbc.queryForObject(sql("SELECT plan_type FROM trips WHERE id=6"),String.class));
    }

    @Test void deletingTripAndAccountRetainsPaymentAndAuditReceipt() {
        user(5); trip(7,5,"FREE"); PaymentEntity p=tx.prepare(5L,7L,"TRIP_PRO",400,"STRIPE");
        tx.apply(p.id,session(p,0),null,"evt_deleted","checkout.session.completed");
        execute("DELETE FROM users WHERE id=5");
        PaymentEntity saved=mapper.findById(p.id); assertNull(saved.userId); assertNull(saved.tripId);
        assertEquals(7L,saved.orderTripId); assertEquals(5L,saved.orderUserId); assertEquals("PAID",saved.status);
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM payment_events WHERE payment_id=?"),Integer.class,p.id));
    }

    @Test void stripeNetworkCallsSeeCommittedOrderAndHaveNoDatabaseTransaction() {
        user(6); trip(8,6,"FREE"); StripeGateway stripe=mock(StripeGateway.class);
        when(stripe.configured()).thenReturn(true);
        when(stripe.createCheckout(any(),any())).thenAnswer(i->{
            assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
            PaymentEntity p=i.getArgument(0);
            assertEquals("PENDING",jdbc.queryForObject(sql("SELECT status FROM payments WHERE id=?"),String.class,p.id));
            ObjectNode s=session(p,0); s.put("status","open"); s.put("payment_status","unpaid"); s.putNull("payment_intent");
            s.put("url","https://checkout.stripe.com/c/pay/cs_test_"+p.id); return s;
        });
        var result=new PaymentService(mapper,tx,stripe,"stripe","https://tabi.example",400).checkout(6L,8L);
        assertEquals("PENDING",result.status());
        assertNotNull(mapper.findById(result.paymentId()).providerPaymentId);
        assertEquals(0,mapper.claimRefresh(result.paymentId()));
        jdbc.update(sql("UPDATE payments SET last_checked_at=NULL WHERE id=?"),result.paymentId());
        assertEquals(1,mapper.claimRefresh(result.paymentId()));
        assertEquals(0,mapper.claimRefresh(result.paymentId()));
        assertNotNull(mapper.reconcileIds(300,86400,10));
    }

    @Test void partialRefundRemainsVisibleAsPaidInAccountSettings() {
        user(7); trip(9,7,"FREE"); PaymentEntity p=tx.prepare(7L,9L,"TRIP_PRO",400,"STRIPE");
        tx.apply(p.id,session(p,100),null,null,null);
        var settings=account.tripPlans(7L);
        assertEquals("PARTIALLY_REFUNDED",mapper.findById(p.id).status);
        assertEquals("PRO",settings.get(0).planType); assertEquals(400,settings.get(0).amount); assertNotNull(settings.get(0).paidAt);
    }

    @Test void dailyBudgetSurvivesProjectDeletionAndRejectedQueueRollsBack(){
        user(20);trip(20,20,"PRO");video(101,20,20);video(102,20,20);
        costProps.setEnforce(true);costProps.setAccountDailyRenders(1);
        queueWithBudget(20,101);execute("DELETE FROM video_projects WHERE id=101");
        assertThrows(RuntimeException.class,()->queueWithBudget(20,102));
        assertEquals("DRAFT",jdbc.queryForObject(sql("SELECT status FROM video_projects WHERE id=102"),String.class));
        assertEquals(1,costs.usage(20L).renderRequests());assertEquals(30,costs.usage(20L).outputSeconds());
    }
    @Test void concurrentGlobalQueueBudgetAdmitsOnlyOneRequest()throws Exception{
        user(21);trip(21,21,"PRO");video(103,21,21);video(104,21,21);
        costProps.setEnforce(true);costProps.setGlobalActiveRenders(1);
        try(ExecutorService pool=Executors.newFixedThreadPool(2)){
            List<Callable<Boolean>> calls=List.of(()->{try{queueWithBudget(21,103);return true;}catch(com.tabitrace.common.BusinessException e){return false;}},
                    ()->{try{queueWithBudget(21,104);return true;}catch(com.tabitrace.common.BusinessException e){return false;}});
            int admitted=0;for(Future<Boolean> f:pool.invokeAll(calls))if(f.get())admitted++;
            assertEquals(1,admitted);assertEquals(1,costMapper.activeGlobal());assertEquals(1,costs.usage(21L).renderRequests());
        }
    }
    @Test void monitorOnlyModeDoesNotEnforceConfiguredBudgetsAndWarningsAreDeduplicated(){
        user(22);trip(22,22,"PRO");video(105,22,22);video(106,22,22);
        costProps.setAccountDailyRenders(1);costProps.setWarnDailyRenders(1);
        queueWithBudget(22,105);queueWithBudget(22,106);
        assertEquals(2,costs.usage(22L).renderRequests());
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM cost_alerts WHERE scope='user:22' AND kind='DAILY_RENDERS'"),Integer.class));
        costProps.setWarnDailyRenders(20);
    }
    @Test void storageObservationSeparatesKnownAndUnknownBytesAndDoesNotCountOtherAccounts(){
        user(23);trip(23,23,"PRO");video(107,23,23);video(108,23,23);
        execute("INSERT INTO photos(id,user_id,file_size,thumb_key,medium_key) VALUES(1,23,100,'thumb','medium'),(2,23,NULL,NULL,NULL),(3,11,999999,NULL,NULL)");
        execute("UPDATE video_projects SET renderer='FFMPEG',output_key='old.mp4' WHERE user_id=23");
        execute("UPDATE video_projects SET output_bytes=512 WHERE id=107");
        execute("INSERT INTO user_music(user_id,title,original_filename,storage_key,mime_type,file_size,status,copyright_confirmed,copyright_confirmed_at,created_at,updated_at) VALUES(23,'test','test.mp3','user-music/23/test.mp3','audio/mpeg',30,'READY',TRUE,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())");
        var m=costs.usage(23L).media();assertEquals(100,m.photoBytes());assertEquals(30,m.musicReservedBytes());assertEquals(512,m.videoBytes());
        assertEquals(6291456,m.variantEstimateBytes());assertEquals(1,m.unknownPhotos());assertEquals(1,m.unknownVideos());
        assertEquals(0,costs.usage(23L).renderRequests());
    }

    @Test void deletingQueuedVideoCommitsDurableOutputCleanupWithoutRefundingUsage(){
        user(30);trip(30,30,"PRO");video(130,30,30);queueWithBudget(30,130);
        videoService.delete(30L,130L);
        assertNull(videos.findById(130L));
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions WHERE project_id=130 AND user_id=30 AND trip_id=30"),Integer.class));
        assertEquals(1,costs.usage(30L).renderRequests());
        verifyNoInteractions(storage);
    }

    @Test void deletingProcessingOrForeignVideoDoesNotEnqueueCleanup(){
        user(31);trip(31,31,"PRO");video(131,31,31);
        execute("UPDATE video_projects SET status='PROCESSING' WHERE id=131");
        assertThrows(com.tabitrace.common.BusinessException.class,()->videoService.delete(31L,131L));
        assertThrows(com.tabitrace.common.BusinessException.class,()->videoService.delete(11L,131L));
        assertEquals("PROCESSING",videos.findById(131L).status);
        assertEquals(0,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions"),Integer.class));
    }

    @Test void tripDeletionRollsBackCleanupOnStorageFailureAndRetryCapturesAllVideos(){
        user(32);trip(32,32,"PRO");trip(132,32,"PRO");video(132,32,32);video(133,32,32);video(134,32,132);
        execute("UPDATE video_projects SET status='PROCESSING' WHERE id=133");
        doThrow(new IllegalStateException("simulated storage outage")).when(storage).deleteAll(anyCollection());
        assertThrows(IllegalStateException.class,()->tripDeletion.delete(32L,32L));
        assertNotNull(videos.findById(132L));assertNotNull(videos.findById(133L));
        assertEquals(0,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions"),Integer.class));
        reset(storage);
        tripDeletion.delete(32L,32L);
        assertNull(videos.findById(132L));assertNull(videos.findById(133L));assertNotNull(videos.findById(134L));
        assertEquals(2,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions WHERE user_id=32 AND trip_id=32"),Integer.class));
    }

    @Test void expiredAccountCleanupIsAtomicAndSurvivesAccountCascade(){
        user(33);trip(33,33,"PRO");video(135,33,33);
        execute("UPDATE users SET status='DELETION_PENDING',deletion_scheduled_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE id=33");
        doThrow(new IllegalStateException("simulated storage outage")).when(storage).deletePrefix("users/33/");
        assertEquals(0,accountDeletion.purgeDue());
        assertNotNull(videos.findById(135L));
        assertEquals(0,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions"),Integer.class));
        reset(storage);
        assertEquals(1,accountDeletion.purgeDue());
        assertNull(videos.findById(135L));
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions WHERE project_id=135 AND user_id=33"),Integer.class));
        assertEquals(0,accountDeletion.purgeDue());
    }

    @Test void queuedWorkerClaimWaitsForDeletionAndCannotRenderDeletedProject() throws Exception {
        user(34);trip(34,34,"PRO");video(136,34,34);execute("UPDATE video_projects SET status='QUEUED' WHERE id=136");
        CountDownLatch locked=new CountDownLatch(1),release=new CountDownLatch(1),claimStarted=new CountDownLatch(1);
        // The real service holds the project row lock before asking whether its trip is writable.
        doAnswer(i->{locked.countDown();assertTrue(release.await(5,TimeUnit.SECONDS));return tripMock.requireOwned(34L,34L);})
                .when(tripMock).requireWritable(34L,34L);
        try(ExecutorService pool=Executors.newFixedThreadPool(2)){
            Future<?> deletion=pool.submit(()->videoService.delete(34L,136L));
            try {
                assertTrue(locked.await(5,TimeUnit.SECONDS));
                Future<Integer> claim=pool.submit(()->{claimStarted.countDown();return jdbc.update(sql("UPDATE video_projects SET status='PROCESSING' WHERE id=136 AND status='QUEUED'"));});
                assertTrue(claimStarted.await(5,TimeUnit.SECONDS));
                assertThrows(TimeoutException.class,()->claim.get(200,TimeUnit.MILLISECONDS));
                release.countDown();deletion.get(5,TimeUnit.SECONDS);
                assertEquals(0,claim.get(5,TimeUnit.SECONDS));
                assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions WHERE project_id=136"),Integer.class));
            } finally { release.countDown(); }
        }
    }
}
