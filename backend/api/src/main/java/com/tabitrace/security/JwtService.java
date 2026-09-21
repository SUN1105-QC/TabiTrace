package com.tabitrace.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.access-ttl-minutes:15}") long accessMinutes,
                      @Value("${app.jwt.refresh-ttl-days:30}") long refreshDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = Duration.ofMinutes(accessMinutes);
        this.refreshTtl = Duration.ofDays(refreshDays);
    }

    public String createAccessToken(Long userId, String email) {
        return createToken(userId, email, "ACCESS", UUID.randomUUID().toString(), accessTtl);
    }

    public TokenWithJti createRefreshToken(Long userId, String email) {
        String jti = UUID.randomUUID().toString();
        return new TokenWithJti(createToken(userId, email, "REFRESH", jti, refreshTtl), jti, Instant.now().plus(refreshTtl));
    }

    private String createToken(Long userId, String email, String type, String jti, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .id(jti)
                .claim("email", email)
                .claim("type", type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public Duration accessTtl() { return accessTtl; }
    public record TokenWithJti(String token, String jti, Instant expiresAt) {}
}
