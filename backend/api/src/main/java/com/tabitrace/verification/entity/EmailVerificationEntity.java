package com.tabitrace.verification.entity;

import java.time.LocalDateTime;

public class EmailVerificationEntity {
    public Long id;
    public String email;
    public String purpose;
    public String codeHash;
    public int attempts;
    public int maxAttempts;
    public String sendStatus;
    public LocalDateTime expiresAt;
    public LocalDateTime verifiedAt;
    public String tokenHash;
    public LocalDateTime tokenExpiresAt;
    public LocalDateTime consumedAt;
    public LocalDateTime invalidatedAt;
    public String requesterIpHash;
    public LocalDateTime createdAt;
    /** 以下由查询用数据库时间（UTC_TIMESTAMP）计算，避免应用与数据库时钟不一致 */
    public boolean expired;
    public boolean tokenExpired;
}
