package com.tabitrace.migration;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchemaTestDatabaseGuardTest {
    @Test void acceptsExplicitLoopbackSchemaNames() {
        assertEquals("tabitrace_schema_test", SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://127.0.0.1:3306/tabitrace_schema_test?serverTimezone=UTC"));
        assertEquals("ci_schema_test", SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://localhost/ci_schema_test"));
        assertEquals("ci_schema_test", SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://[::1]:3306/ci_schema_test"));
    }

    @Test void refusesBusinessSystemOrAmbiguousSchemas() {
        for (String schema : new String[]{"tabitrace", "tabitrace_test", "mysql", "information_schema", "_schema_test", "ci_schema_test/other", ""})
            assertThrows(IllegalArgumentException.class, () -> SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://127.0.0.1/" + schema));
    }

    @Test void refusesRemoteOrNonMysqlConnections() {
        for (String url : new String[]{null, "jdbc:h2:mem:ci_schema_test", "jdbc:postgresql://localhost/ci_schema_test",
                "jdbc:mysql://production.example/ci_schema_test", "jdbc:mysql://192.0.2.1/ci_schema_test", "jdbc:mysql:loadbalance://localhost/ci_schema_test"})
            assertThrows(IllegalArgumentException.class, () -> SchemaTestDatabaseGuard.requireIsolatedUrl(url));
    }

    @Test void embeddedCredentialsAreRefusedWithoutLoggingTheirValues() {
        var failure = assertThrows(IllegalArgumentException.class,
                () -> SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://user:never-print-this@localhost/ci_schema_test"));
        assertFalse(failure.getMessage().contains("never-print-this"));
    }

    @Test void driverSideDatabaseCreationAndInitializationOptionsAreRefused() {
        for (String query : new String[]{"createDatabaseIfNotExist=true", "sessionVariables=anything", "allowMultiQueries=true", "user=root", "password=never-print-this"}) {
            var failure = assertThrows(IllegalArgumentException.class,
                    () -> SchemaTestDatabaseGuard.requireIsolatedUrl("jdbc:mysql://127.0.0.1/ci_schema_test?" + query));
            assertFalse(failure.getMessage().contains("never-print-this"));
        }
    }

    @Test void existingSchemaObjectsAreRefusedBeforeMigration() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT DATABASE()", String.class)).thenReturn("ci_schema_test");
        when(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()", Long.class)).thenReturn(1L);
        assertThrows(IllegalStateException.class, () -> SchemaTestDatabaseGuard.requireEmptySchema(jdbc, "ci_schema_test"));
        verify(jdbc, never()).execute(anyString());
    }

    @Test void connectionCatalogMustMatchTheValidatedUrl() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT DATABASE()", String.class)).thenReturn("tabitrace");
        assertThrows(IllegalStateException.class, () -> SchemaTestDatabaseGuard.requireEmptySchema(jdbc, "ci_schema_test"));
        verify(jdbc, never()).execute(anyString());
        verify(jdbc, never()).queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()", Long.class);
    }

    @Test void onlyAnActuallyEmptyDedicatedSchemaMayProceed() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT DATABASE()", String.class)).thenReturn("ci_schema_test");
        when(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()", Long.class)).thenReturn(0L);
        assertDoesNotThrow(() -> SchemaTestDatabaseGuard.requireEmptySchema(jdbc, "ci_schema_test"));
        verify(jdbc, never()).execute(anyString());
    }
}
