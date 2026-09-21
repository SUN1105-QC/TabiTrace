package com.tabitrace.auth.entity;

import java.time.LocalDateTime;

public class RefreshTokenEntity {
    public Long id;
    public Long userId;
    public String jti;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
    public LocalDateTime createdAt;
}
