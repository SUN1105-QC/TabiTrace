package com.tabitrace.verification.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.mail.MailDeliveryException;
import com.tabitrace.mail.MailService;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.verification.VerificationPurpose;
import com.tabitrace.verification.entity.EmailVerificationEntity;
import com.tabitrace.verification.mapper.EmailVerificationMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 通用邮箱验证码（按 purpose 隔离）：
 *   send    生成 6 位验证码（SecureRandom）→ 只存 HMAC 哈希 → SMTP 发送；发送失败则作废记录并返回真实失败
 *   verify  校验验证码（过期 / 次数上限 / 行锁防并发猜码）→ 成功后签发一次性的 emailVerificationToken（只存 SHA-256）
 *   consume 在调用方事务内一次性消费令牌，必须与邮箱、用途一致
 * 频率限制全部在服务端：同一邮箱同一用途 60 秒冷却、每个邮箱每小时上限、每个 IP 每小时上限。
 * 验证码与令牌都不会出现在响应、日志或数据库明文中。
 */
@Service
public class EmailVerificationService {
    /** 当前开放的用途；RESET_PASSWORD / CHANGE_EMAIL 接入对应流程时加进来即可 */
    static final Set<VerificationPurpose> ENABLED = EnumSet.of(VerificationPurpose.REGISTER);
    static final long HOUR = 3600;

    private final EmailVerificationMapper mapper;
    private final UserMapper users;
    private final MailService mail;
    private final byte[] secret;
    private final String loginUrl;
    final long codeTtlSeconds;
    final long resendAfterSeconds;
    final int maxAttempts;
    final long tokenTtlSeconds;
    final int emailHourlyLimit;
    final int ipHourlyLimit;
    private final SecureRandom random = new SecureRandom();

    public EmailVerificationService(EmailVerificationMapper mapper, UserMapper users, MailService mail,
                                    @Value("${app.email-verification.secret:${app.jwt.secret}}") String secret,
                                    @Value("${app.public-url:http://localhost:3000}") String publicUrl,
                                    @Value("${app.email-verification.code-ttl-seconds:600}") long codeTtlSeconds,
                                    @Value("${app.email-verification.resend-after-seconds:60}") long resendAfterSeconds,
                                    @Value("${app.email-verification.max-attempts:5}") int maxAttempts,
                                    @Value("${app.email-verification.token-ttl-seconds:1800}") long tokenTtlSeconds,
                                    @Value("${app.email-verification.email-hourly-limit:5}") int emailHourlyLimit,
                                    @Value("${app.email-verification.ip-hourly-limit:20}") int ipHourlyLimit) {
        this.mapper = mapper; this.users = users; this.mail = mail;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.loginUrl = publicUrl.replaceAll("/$", "") + "/login";
        this.codeTtlSeconds = codeTtlSeconds; this.resendAfterSeconds = resendAfterSeconds; this.maxAttempts = maxAttempts;
        this.tokenTtlSeconds = tokenTtlSeconds; this.emailHourlyLimit = emailHourlyLimit; this.ipHourlyLimit = ipHourlyLimit;
    }

    public record SendResult(long expiresIn, long resendAfter) {}
    public record VerifyResult(String emailVerificationToken, long expiresIn) {}

    // ---------------------------------------------------------------- send

    public SendResult send(String rawEmail, VerificationPurpose purpose, String clientIp) {
        requireEnabled(purpose);
        String email = normalizeEmail(rawEmail);
        String ipHash = hmacHex("ip:" + (clientIp == null ? "" : clientIp));
        enforceRateLimit(email, purpose, ipHash);

        // 注册用途下邮箱已存在：不发验证码，改发“已有账号”提醒；对外响应保持一致，避免被用来探测邮箱是否注册
        boolean alreadyRegistered = purpose == VerificationPurpose.REGISTER && users.findByEmail(email) != null;
        String code = generateCode();

        EmailVerificationEntity e = new EmailVerificationEntity();
        e.email = email;
        e.purpose = purpose.name();
        e.codeHash = alreadyRegistered ? hmacHex("unusable:" + generateToken()) : codeHash(purpose, email, code);
        e.maxAttempts = maxAttempts;
        e.requesterIpHash = ipHash;
        e.invalidatedAt = alreadyRegistered ? LocalDateTime.now(ZoneOffset.UTC) : null;
        mapper.insert(e, codeTtlSeconds);
        // 并发的重复请求：两个都通过了上面的预检查时，较晚插入的一方在这里被拦下
        if (mapper.countEarlierSendsWithin(email, purpose.name(), e.id, resendAfterSeconds) > 0) {
            mapper.markThrottled(e.id);
            throw limited("RESEND_TOO_SOON", "请在 " + resendAfterSeconds + " 秒后重新获取验证码", resendAfterSeconds);
        }

        VerificationEmails.Mail message = alreadyRegistered
            ? VerificationEmails.accountExists(loginUrl)
            : VerificationEmails.code(purpose, code, codeTtlSeconds);
        try {
            mail.send(email, message.subject(), message.text(), message.html());
        } catch (MailDeliveryException ex) {
            mapper.markFailed(e.id);
            throw new BusinessException("EMAIL_SEND_FAILED", "验证码邮件发送失败，请稍后重试", HttpStatus.SERVICE_UNAVAILABLE);
        }
        mapper.markSent(e.id);
        if (!alreadyRegistered) mapper.invalidateOthers(email, purpose.name(), e.id);
        return new SendResult(codeTtlSeconds, resendAfterSeconds);
    }

    void enforceRateLimit(String email, VerificationPurpose purpose, String ipHash) {
        Long since = mapper.secondsSinceLastSend(email, purpose.name());
        if (since != null && since < resendAfterSeconds) {
            long wait = resendAfterSeconds - since;
            throw limited("RESEND_TOO_SOON", "请在 " + wait + " 秒后重新获取验证码", wait);
        }
        if (mapper.countByEmailSince(email, HOUR) >= emailHourlyLimit)
            throw limited("TOO_MANY_REQUESTS", "这个邮箱获取验证码太频繁了，请稍后再试", orOne(mapper.emailWindowResetSeconds(email, HOUR)));
        if (mapper.countByIpSince(ipHash, HOUR) >= ipHourlyLimit)
            throw limited("TOO_MANY_REQUESTS", "获取验证码太频繁了，请稍后再试", orOne(mapper.ipWindowResetSeconds(ipHash, HOUR)));
    }

    private static long orOne(Long v) { return v == null || v < 1 ? 1 : v; }

    private static BusinessException limited(String code, String message, long retryAfter) {
        return new BusinessException(code, message, HttpStatus.TOO_MANY_REQUESTS, Map.of("retryAfter", retryAfter));
    }

    // ---------------------------------------------------------------- verify

    /** 猜错时的次数 +1 必须提交，所以业务异常不回滚 */
    @Transactional(noRollbackFor = BusinessException.class)
    public VerifyResult verify(String rawEmail, String code, VerificationPurpose purpose) {
        requireEnabled(purpose);
        String email = normalizeEmail(rawEmail);
        EmailVerificationEntity e = mapper.lockPending(email, purpose.name());
        if (e == null) throw new BusinessException("CODE_INVALID", "验证码不正确或已失效，请重新获取");
        if (e.expired) throw new BusinessException("CODE_EXPIRED", "验证码已过期，请重新获取");
        if (e.attempts >= e.maxAttempts) throw locked();
        if (code == null || !constantTimeEquals(codeHash(purpose, email, code.trim()), e.codeHash)) {
            mapper.incrementAttempts(e.id);
            int remaining = e.maxAttempts - e.attempts - 1;
            if (remaining <= 0) throw locked();
            throw new BusinessException("CODE_INVALID", "验证码不正确，还可以再试 " + remaining + " 次", HttpStatus.BAD_REQUEST, Map.of("remainingAttempts", remaining));
        }
        String token = generateToken();
        mapper.markVerified(e.id, sha256Hex(token), tokenTtlSeconds);
        return new VerifyResult(token, tokenTtlSeconds);
    }

    private static BusinessException locked() {
        return new BusinessException("CODE_LOCKED", "验证码错误次数过多，已失效，请重新获取", HttpStatus.BAD_REQUEST, Map.of("remainingAttempts", 0));
    }

    // ---------------------------------------------------------------- consume

    /**
     * 在调用方事务里一次性消费令牌（例如注册）。行锁 + consumed_at 条件更新保证并发请求只有一个成功；
     * 调用方后续失败（如邮箱已被占用）时整个事务回滚，令牌仍可再用。
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void consume(String token, String rawEmail, VerificationPurpose purpose) {
        if (token == null || token.isBlank())
            throw new BusinessException("EMAIL_VERIFICATION_REQUIRED", "请先完成邮箱验证");
        String email = normalizeEmail(rawEmail);
        EmailVerificationEntity e = mapper.lockByToken(sha256Hex(token.trim()));
        if (e == null || e.verifiedAt == null || e.invalidatedAt != null)
            throw new BusinessException("EMAIL_TOKEN_INVALID", "邮箱验证已失效，请重新获取验证码");
        if (!purpose.name().equals(e.purpose) || !email.equals(e.email))
            throw new BusinessException("EMAIL_TOKEN_MISMATCH", "邮箱验证与当前邮箱不一致，请重新验证");
        if (e.consumedAt != null)
            throw new BusinessException("EMAIL_TOKEN_USED", "这次邮箱验证已经使用过，请重新获取验证码");
        if (e.tokenExpired)
            throw new BusinessException("EMAIL_TOKEN_EXPIRED", "邮箱验证已过期，请重新获取验证码");
        if (mapper.consume(e.id) != 1)
            throw new BusinessException("EMAIL_TOKEN_USED", "这次邮箱验证已经使用过，请重新获取验证码");
    }

    // ---------------------------------------------------------------- 清理

    @Scheduled(cron = "${app.email-verification.cleanup-cron:0 17 3 * * *}")
    public void cleanup() { mapper.deleteOlderThan(7); }

    // ---------------------------------------------------------------- 工具

    private static void requireEnabled(VerificationPurpose purpose) {
        if (!ENABLED.contains(purpose)) throw new BusinessException("PURPOSE_NOT_SUPPORTED", "暂不支持这种验证");
    }

    public static String normalizeEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty() || email.length() > 255 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            throw new BusinessException("INVALID_EMAIL", "邮箱格式不正确");
        return email;
    }

    /** 6 位数字，000000~999999 均匀分布 */
    String generateCode() { return String.format("%06d", random.nextInt(1_000_000)); }

    private String generateToken() {
        byte[] b = new byte[32];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** 带服务端密钥的 HMAC：即使数据库泄露，也无法离线穷举 6 位验证码 */
    String codeHash(VerificationPurpose purpose, String email, String code) {
        return hmacHex(purpose.name() + ":" + email + ":" + code);
    }

    private String hmacHex(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) { throw new IllegalStateException(ex); }
    }

    static String sha256Hex(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (GeneralSecurityException ex) { throw new IllegalStateException(ex); }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }
}
