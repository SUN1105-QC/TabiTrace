package com.tabitrace.auth.service;

import com.tabitrace.auth.mapper.LoginFailureMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.common.Hashing;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 登录频率限制：窗口内（默认 15 分钟）同一邮箱失败 8 次、或同一 IP 失败 40 次后，暂时拒绝登录。
 * 在校验密码之前检查，拒绝时不会泄露账号是否存在（不存在的邮箱同样计数）。
 */
@Service
public class LoginThrottleService {
    private final LoginFailureMapper mapper;
    private final byte[] secret;
    final long windowSeconds;
    final int emailLimit;
    final int ipLimit;

    public LoginThrottleService(LoginFailureMapper mapper,
                                @Value("${app.jwt.secret}") String secret,
                                @Value("${app.login-throttle.window-seconds:900}") long windowSeconds,
                                @Value("${app.login-throttle.email-limit:8}") int emailLimit,
                                @Value("${app.login-throttle.ip-limit:40}") int ipLimit) {
        this.mapper = mapper; this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.windowSeconds = windowSeconds; this.emailLimit = emailLimit; this.ipLimit = ipLimit;
    }

    public void check(String email, String clientIp) {
        if (mapper.countByEmailSince(email, windowSeconds) >= emailLimit)
            throw limited(orOne(mapper.emailWindowResetSeconds(email, windowSeconds)));
        String ipHash = ipHash(clientIp);
        if (ipHash != null && mapper.countByIpSince(ipHash, windowSeconds) >= ipLimit)
            throw limited(orOne(mapper.ipWindowResetSeconds(ipHash, windowSeconds)));
    }

    public void recordFailure(String email, String clientIp) { mapper.insert(email, ipHash(clientIp)); }

    /** 登录成功或重置密码后，清掉该邮箱的失败记录 */
    public void clear(String email) { mapper.clear(email); }

    @Scheduled(cron = "${app.login-throttle.cleanup-cron:0 37 * * * *}")
    public void cleanup() { mapper.deleteExpired(); }

    private String ipHash(String ip) { return ip == null || ip.isBlank() ? null : Hashing.hmacSha256Hex(secret, "login-ip:" + ip); }

    private static long orOne(Long v) { return v == null || v < 1 ? 1 : v; }

    private static BusinessException limited(long retryAfter) {
        return new BusinessException("TOO_MANY_ATTEMPTS", "尝试次数过多，请稍后再试", HttpStatus.TOO_MANY_REQUESTS, Map.of("retryAfter", retryAfter));
    }
}
