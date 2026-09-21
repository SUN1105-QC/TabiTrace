package com.tabitrace.payment.entity;

import java.time.LocalDateTime;

public class PaymentEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    public String provider;
    public String providerPaymentId;
    public Integer amount;
    public String currency;
    public String status;
    public LocalDateTime paidAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
