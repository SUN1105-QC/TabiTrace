package com.tabitrace.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Opt-in, full real-MySQL migration. The target must be an empty loopback *_schema_test database.
 * No clean/drop operation exists here. CI discards its MySQL service after the job.
 * The PAYMENT_TEST_DB_* prefix-table suite may share this dedicated database; business databases may not.
 */
@EnabledIfEnvironmentVariable(named = "SCHEMA_TEST_DB_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MySqlSchemaMigrationIntegrationTest {
    private JdbcTemplate jdbc;
    private Flyway flyway;

    @BeforeAll void migrateNewEmptySchema() {
        String url = System.getenv("SCHEMA_TEST_DB_URL");
        String schema = SchemaTestDatabaseGuard.requireIsolatedUrl(url);
        String user = Objects.requireNonNull(System.getenv("SCHEMA_TEST_DB_USER"), "SCHEMA_TEST_DB_USER is required");
        String password = Objects.requireNonNull(System.getenv("SCHEMA_TEST_DB_PASSWORD"), "SCHEMA_TEST_DB_PASSWORD is required");
        var dataSource = new DriverManagerDataSource(url, user, password);
        jdbc = new JdbcTemplate(dataSource);
        SchemaTestDatabaseGuard.requireEmptySchema(jdbc, schema);
        flyway = Flyway.configure().dataSource(dataSource).schemas(schema).createSchemas(false)
                .locations("classpath:db/migration").cleanDisabled(true).baselineOnMigrate(false)
                .validateMigrationNaming(true).load();
        assertEquals(24, flyway.migrate().migrationsExecuted, "Every V1–V24 migration must execute from empty");
    }

    @Test void migrationHistoryIsCompleteValidAndIdempotent() {
        assertEquals(IntStream.rangeClosed(1, 24).mapToObj(Integer::toString).toList(),
                jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank", String.class));
        assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success=FALSE", Long.class));
        assertEquals("24", flyway.info().current().getVersion().getVersion());
        assertDoesNotThrow(() -> flyway.validate());
        assertEquals(0, flyway.migrate().migrationsExecuted, "Repeated startup must not replay migrations");
    }

    @Test void allExpectedTablesExistWithoutDemoBusinessData() {
        Set<String> expected = Set.of("users", "refresh_tokens", "official_cities", "places", "trips", "trip_places", "itinerary_items",
                "checkins", "photos", "achievements", "user_achievements", "payments", "share_links", "video_projects", "video_project_photos",
                "video_templates", "video_music", "official_routes", "place_favorites", "destinations", "email_verifications", "login_failures",
                "memberships", "user_music", "payment_events", "cost_control_locks", "render_usage_daily", "cost_alerts", "video_output_deletions",
                "explore_countries", "explore_city_entries", "flyway_schema_history");
        assertEquals(new TreeSet<>(expected), new TreeSet<>(jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", String.class)));
        for (String table : List.of("users", "trips", "checkins", "photos", "user_achievements", "payments", "payment_events", "share_links",
                "video_projects", "video_project_photos", "memberships", "user_music", "render_usage_daily", "cost_alerts", "video_output_deletions"))
            assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class), table + " must not contain demonstration records");
    }

    @Test void productCatalogAndPermanentRenderLockAreSeeded() {
        assertEquals(1L, jdbc.queryForObject("SELECT COUNT(*) FROM official_cities WHERE code='TOKYO'", Long.class));
        assertEquals(30L, jdbc.queryForObject("SELECT COUNT(*) FROM places WHERE source_type='OFFICIAL' AND city='东京'", Long.class));
        assertEquals(3L, jdbc.queryForObject("SELECT COUNT(*) FROM video_templates", Long.class));
        assertTrue(jdbc.queryForObject("SELECT COUNT(*) FROM destinations", Long.class) > 0);
        assertTrue(jdbc.queryForObject("SELECT COUNT(*) FROM official_routes", Long.class) > 0);
        assertEquals(19L, jdbc.queryForObject("SELECT COUNT(*) FROM video_music WHERE enabled=TRUE AND status='APPROVED'", Long.class));
        assertEquals(List.of("video-render"), jdbc.queryForList("SELECT name FROM cost_control_locks", String.class));
    }

    @Test void expandedGuidesAreCompleteAndUnimplementedPreviewsStayClosed() {
        assertEquals(3L,jdbc.queryForObject("SELECT COUNT(*) FROM explore_countries WHERE published=TRUE",Long.class));
        assertEquals(6L,jdbc.queryForObject("SELECT COUNT(*) FROM explore_city_entries WHERE published=TRUE",Long.class));
        assertEquals(4L,jdbc.queryForObject("SELECT COUNT(*) FROM official_cities WHERE status='ACTIVE'",Long.class));
        assertEquals("TW",jdbc.queryForObject("SELECT country_code FROM official_cities WHERE code='TAIPEI'",String.class));
        assertEquals("CN",jdbc.queryForObject("SELECT country_code FROM explore_city_entries WHERE city_code='TAIPEI'",String.class));
        assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM explore_city_entries WHERE city_code IN ('OSAKA','KYOTO') AND explore_path IS NOT NULL",Long.class));
        assertEquals("HK",jdbc.queryForObject("SELECT country_code FROM official_cities WHERE code='HONGKONG'",String.class));
        assertEquals("CN",jdbc.queryForObject("SELECT country_code FROM explore_city_entries WHERE city_code='HONGKONG'",String.class));
        // 中国主题内固定为香港在前、台北在后（V23 预告时台北的排序会被 V24 覆盖）
        assertEquals(List.of("HONGKONG","TAIPEI"),jdbc.queryForList("SELECT city_code FROM explore_city_entries WHERE country_code='CN' ORDER BY sort_order,city_code",String.class));
        for(String city:List.of("首尔","香港","台北"))assertEquals(30L,jdbc.queryForObject("SELECT COUNT(*) FROM places WHERE source_type='OFFICIAL' AND city=?",Long.class,city));
        for(String code:List.of("SEOUL","HONGKONG","TAIPEI"))assertEquals(6L,jdbc.queryForObject("SELECT COUNT(*) FROM official_routes WHERE city_code=?",Long.class,code));
        assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM official_routes WHERE city_code IN ('SEOUL','HONGKONG','TAIPEI') AND (place_ids='' OR place_ids IS NULL)",Long.class));
        assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM destinations WHERE name IN ('首尔','香港','台北') AND official_city_code IS NULL",Long.class));
    }

    @Test void financialRetentionAndCleanupConstraintsMatchTheirLifecycle() {
        assertEquals("SET NULL", deleteRule("payments", "user_id"));
        assertEquals("SET NULL", deleteRule("payments", "trip_id"));
        assertTrue(Set.of("RESTRICT", "NO ACTION").contains(deleteRule("payment_events", "payment_id")));
        assertEquals("CASCADE", deleteRule("render_usage_daily", "user_id"));
        assertEquals(0L, jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.key_column_usage
                WHERE table_schema=DATABASE() AND table_name='video_output_deletions' AND referenced_table_name IS NOT NULL
                """, Long.class), "Cleanup tasks must survive project/trip/account deletion");
        assertEquals("scope,usage_date", indexColumns("render_usage_daily", "PRIMARY"));
        assertEquals("project_id", indexColumns("video_output_deletions", "PRIMARY"));
        assertEquals("checkout_key", indexColumns("payments", "uk_payments_checkout_key"));
        assertEquals("event_id", indexColumns("payment_events", "PRIMARY"));
    }

    @Test void upgradedVideoAndPaymentColumnsPreserveUnknownHistoricalValues() {
        assertEquals("YES", nullable("video_projects", "output_bytes"));
        assertEquals("YES", nullable("video_projects", "music_code"));
        assertEquals("YES", nullable("payments", "user_id"));
        assertEquals("YES", nullable("payments", "order_user_id"));
        assertEquals("NO", nullable("users", "lifetime_pro_grant"));
        assertEquals("NO", nullable("trips", "pro_grant"));
        assertEquals(0L, jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema=DATABASE() AND table_name='video_projects' AND column_name='show_map'
                """, Long.class));
    }

    private String deleteRule(String table, String column) {
        return jdbc.queryForObject("""
                SELECT r.delete_rule FROM information_schema.key_column_usage k
                JOIN information_schema.referential_constraints r ON r.constraint_schema=k.table_schema AND r.constraint_name=k.constraint_name
                WHERE k.table_schema=DATABASE() AND k.table_name=? AND k.column_name=? AND k.referenced_table_name IS NOT NULL
                """, String.class, table, column);
    }

    private String indexColumns(String table, String index) {
        return jdbc.queryForObject("""
                SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index) FROM information_schema.statistics
                WHERE table_schema=DATABASE() AND table_name=? AND index_name=?
                """, String.class, table, index);
    }

    private String nullable(String table, String column) {
        return jdbc.queryForObject("""
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema=DATABASE() AND table_name=? AND column_name=?
                """, String.class, table, column);
    }
}
