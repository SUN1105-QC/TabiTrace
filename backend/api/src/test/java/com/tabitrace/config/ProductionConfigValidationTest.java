package com.tabitrace.config;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** prod 启动自检：开发默认值、localhost、Mock 存储 / 支付都会被拒绝，只报变量名 */
class ProductionConfigValidationTest {
    static Map<String, String> good() {
        Map<String, String> m = new HashMap<>();
        m.put("app.jwt.secret", "q8Vf3mZr1LxT9pWc2HsK7nYbE4uGdJ6aR0tXvB5eN8kQ");
        m.put("app.public-url", "https://tabitrace.example.com");
        m.put("app.cors.allowed-origins", "https://tabitrace.example.com");
        m.put("spring.datasource.password", "a-strong-db-password");
        m.put("app.storage.mode", "r2");
        m.put("app.storage.r2.endpoint", "https://acc.r2.cloudflarestorage.com");
        m.put("app.storage.r2.access-key", "ak");
        m.put("app.storage.r2.secret-key", "sk");
        m.put("app.storage.r2.bucket", "media");
        m.put("app.storage.r2.public-base-url", "https://media.example.com");
        m.put("app.mail.provider", "resend");
        m.put("app.mail.resend.api-key", "key");
        m.put("app.mail.from-address", "no-reply@example.com");
        m.put("app.video.mock-renderer-enabled", "false");
        m.put("app.payments.mode", "stripe");
        return m;
    }

    @Test void completeProductionConfigPasses() {
        assertEquals(List.of(), ProductionSecretsValidator.validate(good()::get));
    }

    @Test void developmentDefaultsAreRejected() {
        Map<String, String> m = good();
        m.put("app.public-url", "http://localhost:3000");
        m.put("app.cors.allowed-origins", "https://tabitrace.example.com,*");
        m.put("spring.datasource.password", "tabitrace_dev");
        m.put("app.storage.mode", "local");
        m.put("app.storage.r2.public-base-url", "https://example.invalid/r2");
        m.put("app.mail.provider", "smtp");
        m.put("spring.mail.host", "localhost");
        m.put("app.mail.from-address", "no-reply@tabitrace.local");
        m.put("app.video.mock-renderer-enabled", "true");
        m.put("app.payments.mode", "mock");
        String all = String.join("\n", ProductionSecretsValidator.validate(m::get));
        for (String name : List.of("APP_PUBLIC_URL", "CORS_ALLOWED_ORIGINS", "DB_PASSWORD", "STORAGE_MODE", "R2_PUBLIC_BASE_URL", "MAIL_HOST", "MAIL_FROM_ADDRESS", "VIDEO_MOCK_RENDERER", "PAYMENTS_MODE"))
            assertTrue(all.contains(name), name + " 应被拒绝");
        assertFalse(all.contains("tabitrace_dev"), "报错不能包含配置值");
    }

    @Test void resendNeedsApiKeyAndMissingStripeOnlyDisablesPayments() {
        Map<String, String> m = good();
        m.put("app.mail.resend.api-key", "");
        assertTrue(String.join("", ProductionSecretsValidator.validate(m::get)).contains("RESEND_API_KEY"));
        assertFalse(ProductionSecretsValidator.paymentsConfigured(good()::get));
        Map<String, String> paid = good();
        paid.put("app.payments.stripe.secret-key", "sk");
        paid.put("app.payments.stripe.webhook-secret", "wh");
        assertTrue(ProductionSecretsValidator.paymentsConfigured(paid::get));
    }
}
