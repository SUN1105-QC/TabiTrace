package com.tabitrace.auth.entity;

import java.time.LocalDateTime;

public class RefreshTokenEntity {
    public Long id;
    public Long userId;
    public String jti;
    public String userAgent;
    /** 登录会话编号：同一台设备刷新前后不变 */
    public String sessionId;
    public LocalDateTime sessionStartedAt;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
    public LocalDateTime createdAt;
}
