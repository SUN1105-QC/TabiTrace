package com.tabitrace.payment.entity;

import java.time.LocalDateTime;

public class PaymentEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    /** TRIP_PRO（某段旅行）/ LIFETIME（账号买断，tripId 为空） */
    public String product;
    public String provider;
    public String providerPaymentId;
    public Integer amount;
    public String currency;
    public String status;
    public Long orderUserId;
    public Long orderTripId;
    public String checkoutKey;
    public String checkoutUrl;
    public int checkoutAttempts;
    public String paymentIntentId;
    public String chargeId;
    public Integer refundedAmount;
    public String disputeId;
    public String disputeStatus;
    public LocalDateTime expiresAt;
    public LocalDateTime lastSyncedAt;
    public LocalDateTime lastCheckedAt;
    public LocalDateTime paidAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
