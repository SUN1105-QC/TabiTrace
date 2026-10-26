package com.tabitrace.membership.entity;

import java.time.LocalDateTime;

/** 账号会员记录：一条记录是一段会员期；expiresAt 为空表示永久（终身 Pro） */
public class MembershipEntity {
    public Long id;
    public Long userId;
    public String plan;
    /** LIFETIME / SUBSCRIPTION / GRANT */
    public String source;
    /** ACTIVE / CANCELLED / REVOKED */
    public String status;
    public LocalDateTime startedAt;
    public LocalDateTime expiresAt;
    public Long paymentId;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
