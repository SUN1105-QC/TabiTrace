package com.tabitrace.auth.entity;

import java.time.LocalDateTime;

public class RefreshTokenEntity {
    public Long id;
    public Long userId;
    public String jti;
    public String userAgent;
    public LocalDateTime sessionStartedAt;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
    public LocalDateTime createdAt;
}
