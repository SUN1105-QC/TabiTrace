package com.tabitrace.migration;

import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/** Test-only guard: full Flyway migration must never target an existing business schema. */
final class SchemaTestDatabaseGuard {
    private SchemaTestDatabaseGuard() {}

    static String requireIsolatedUrl(String url) {
        if (url == null || !url.startsWith("jdbc:mysql://")) throw invalidUrl();
        final URI uri;
        try {
            uri = URI.create(url.substring("jdbc:".length()));
        } catch (IllegalArgumentException ex) {
            throw invalidUrl();
        }
        String host = uri.getHost();
        if (host == null || !Set.of("localhost", "127.0.0.1", "::1", "[::1]").contains(host.toLowerCase(Locale.ROOT))
                || uri.getUserInfo() != null || uri.getFragment() != null) throw invalidUrl();
        // Some driver options create databases or run initialization SQL before our empty-schema check.
        if (uri.getQuery() != null) for (String option : uri.getQuery().split("&")) {
            String key = option.split("=", 2)[0].toLowerCase(Locale.ROOT);
            if (!Set.of("sslmode", "allowpublickeyretrieval", "servertimezone", "useunicode", "characterencoding", "connecttimeout", "sockettimeout").contains(key))
                throw invalidUrl();
        }
        String path = uri.getPath();
        if (path == null || !path.matches("/[a-z][a-z0-9_]{0,50}_schema_test")) throw invalidUrl();
        return path.substring(1);
    }

    static void requireEmptySchema(JdbcTemplate jdbc, String expectedSchema) {
        String actual = jdbc.queryForObject("SELECT DATABASE()", String.class);
        if (!expectedSchema.equals(actual)) throw new IllegalStateException("Test connection selected an unexpected schema; migration refused");
        Long tables = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()", Long.class);
        if (tables == null || tables != 0) throw new IllegalStateException("Full migration test requires a new empty schema; existing objects are never cleaned or migrated");
    }

    private static IllegalArgumentException invalidUrl() {
        // Do not echo a supplied JDBC URL, which could contain credentials.
        return new IllegalArgumentException("SCHEMA_TEST_DB_URL requires loopback MySQL, a dedicated *_schema_test database and only basic connection options without credentials or initialization SQL");
    }
}
