package com.tabitrace.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

/**
 * prod 启动自检：生产配置缺失或仍是开发默认值时直接启动失败（部署失败、旧版本继续服务），
 * 而不是带着 localhost、Mock 存储、开发密钥“看起来正常”地上线。
 * 报错只列出变量名，不输出任何值。
 */
@Component
@Profile("prod")
public class ProductionSecretsValidator {
    private static final Logger log = LoggerFactory.getLogger(ProductionSecretsValidator.class);

    public ProductionSecretsValidator(Environment env) {
        List<String> problems = validate(env::getProperty);
        if (!problems.isEmpty())
            throw new IllegalStateException("生产配置不完整，拒绝启动：\n - " + String.join("\n - ", problems));
        if (!paymentsConfigured(env::getProperty))
            log.warn("PAYMENTS: 未配置 STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET，Trip Pro 升级将显示“支付暂未开放”");
    }

    static List<String> validate(Function<String, String> p) {
        List<String> problems = new ArrayList<>();
        try { validateJwtSecret(p.apply("app.jwt.secret")); } catch (IllegalStateException e) { problems.add("JWT_SECRET：" + e.getMessage()); }

        String publicUrl = p.apply("app.public-url");
        if (blank(publicUrl) || !publicUrl.startsWith("https://") || isLocal(publicUrl))
            problems.add("APP_PUBLIC_URL：必须是正式站点的 https 地址（邮件、分享链接与支付回跳都会使用它）");

        String origins = p.apply("app.cors.allowed-origins");
        if (blank(origins) || Arrays.stream(origins.split(",")).map(String::trim).anyMatch(o -> o.equals("*") || isLocal(o)))
            problems.add("CORS_ALLOWED_ORIGINS：只能填写正式站点域名，不能包含 * 或 localhost");

        if ("tabitrace_dev".equals(p.apply("spring.datasource.password")))
            problems.add("DB_PASSWORD：不能使用开发默认密码");

        if (!"r2".equalsIgnoreCase(p.apply("app.storage.mode")))
            problems.add("STORAGE_MODE：生产环境必须使用对象存储（r2），不能把用户照片写进容器磁盘");
        for (String[] k : new String[][]{{"app.storage.r2.endpoint", "R2_ENDPOINT"}, {"app.storage.r2.access-key", "R2_ACCESS_KEY"},
                {"app.storage.r2.secret-key", "R2_SECRET_KEY"}, {"app.storage.r2.bucket", "R2_BUCKET"}})
            if (blank(p.apply(k[0]))) problems.add(k[1] + "：未配置");
        String publicBase = p.apply("app.storage.r2.public-base-url");
        if (blank(publicBase) || publicBase.contains("example.invalid") || !publicBase.startsWith("https://"))
            problems.add("R2_PUBLIC_BASE_URL：必须是存储桶的 https 公开访问地址");

        String provider = p.apply("app.mail.provider");
        if ("resend".equalsIgnoreCase(provider)) {
            if (blank(p.apply("app.mail.resend.api-key"))) problems.add("RESEND_API_KEY：MAIL_PROVIDER=resend 时必须配置");
        } else if (blank(p.apply("spring.mail.host")) || isLocal(p.apply("spring.mail.host"))) {
            problems.add("MAIL_HOST：生产环境必须配置真实的 SMTP 服务器（或改用 MAIL_PROVIDER=resend）");
        }
        String from = p.apply("app.mail.from-address");
        if (blank(from) || from.endsWith(".local") || !from.contains("@"))
            problems.add("MAIL_FROM_ADDRESS：必须是已在邮件服务商验证过的发件地址");

        if ("true".equalsIgnoreCase(p.apply("app.video.mock-renderer-enabled")))
            problems.add("VIDEO_MOCK_RENDERER：生产环境不能启用模拟视频渲染");
        if (!"stripe".equalsIgnoreCase(p.apply("app.payments.mode")))
            problems.add("PAYMENTS_MODE：生产环境只允许 stripe，不能使用模拟支付");
        return problems;
    }

    static boolean paymentsConfigured(Function<String, String> p) {
        return !blank(p.apply("app.payments.stripe.secret-key")) && !blank(p.apply("app.payments.stripe.webhook-secret"));
    }

    static void validateJwtSecret(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32 || secret.contains("change-me"))
            throw new IllegalStateException("prod 环境必须通过 JWT_SECRET 配置至少 32 字节的随机密钥，不能使用开发默认值");
    }

    private static boolean blank(String v) { return v == null || v.isBlank(); }
    private static boolean isLocal(String v) { return v != null && (v.contains("localhost") || v.contains("127.0.0.1") || v.contains("0.0.0.0")); }
}
