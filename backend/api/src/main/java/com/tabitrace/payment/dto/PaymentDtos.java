package com.tabitrace.payment.dto;

import java.time.LocalDateTime;

public final class PaymentDtos {
    private PaymentDtos() {}
    public record CheckoutResponse(Long paymentId,String status,String checkoutUrl,boolean mock) {}
    public record PaymentView(Long id,Long tripId,String provider,String providerPaymentId,Integer amount,String currency,String status,LocalDateTime paidAt,LocalDateTime createdAt) {}
}
