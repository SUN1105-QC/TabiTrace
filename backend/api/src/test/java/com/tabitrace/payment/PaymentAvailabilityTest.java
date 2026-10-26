package com.tabitrace.payment;

import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.payment.service.StripeGateway;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 计费：单次旅行 ¥4、买断终身 Pro ¥1000；Stripe 收不了低于最低额的金额时明确拒绝，不发起注定失败的付款 */
class PaymentAvailabilityTest {
    PaymentMapper payments = mock(PaymentMapper.class);
    TripMapper tripMapper = mock(TripMapper.class);
    TripService trips = mock(TripService.class);
    UserMapper users = mock(UserMapper.class);
    StripeGateway stripe = mock(StripeGateway.class);

    private PaymentService service(String mode) { return service(mode, PaymentService.DEFAULT_STRIPE_MIN_AMOUNT); }
    private PaymentService service(String mode, int stripeMinAmount) {
        return new PaymentService(payments, trips, tripMapper, users, stripe, mode, "https://tabitrace.example.com", stripeMinAmount);
    }
    private TripEntity freeTrip() {
        TripEntity t = new TripEntity(); t.id = 5L; t.userId = 1L; t.planType = "FREE";
        when(trips.requireOwned(1L, 5L)).thenReturn(t);
        return t;
    }

    @Test void pricesAreFourYuanAndOneThousandYuan() {
        assertEquals(400, PaymentService.TRIP_PRO_AMOUNT);
        assertTrue(PaymentService.TRIP_PRO_AMOUNT >= PaymentService.DEFAULT_STRIPE_MIN_AMOUNT, "单次价格不能低于 Stripe 最低额");
        assertEquals(100000, PaymentService.LIFETIME_AMOUNT);
        assertEquals("CNY", PaymentService.TRIP_PRO_CURRENCY);
    }

    @Test void stripeModeWithoutKeysRefusesCheckoutWithoutTouchingData() {
        when(stripe.configured()).thenReturn(false);
        freeTrip();
        PaymentService service = service("stripe");
        assertTrue(service.realPayments());
        assertFalse(service.paymentsAvailable());
        assertEquals("NOT_CONFIGURED", service.unavailableReason(PaymentService.LIFETIME_AMOUNT));
        BusinessException ex = assertThrows(BusinessException.class, () -> service.checkout(1L, 5L));
        assertEquals("PAYMENTS_UNAVAILABLE", ex.getCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertThrows(BusinessException.class, () -> service.checkoutLifetime(1L));
        verifyNoInteractions(payments);
        verify(tripMapper, never()).updatePlan(any(), any());
    }

    @Test void stripeChargesFourYuanTripPro() {
        when(stripe.configured()).thenReturn(true);
        freeTrip();
        PaymentService service = service("stripe");
        assertTrue(service.canCharge(PaymentService.TRIP_PRO_AMOUNT));
        assertNull(service.unavailableReason(PaymentService.TRIP_PRO_AMOUNT));
        when(stripe.createCheckout(any(), eq(5L), eq("TRIP_PRO"), any(), eq(400), eq("CNY"), any(), any())).thenReturn(new StripeGateway.Session("cs_t", "https://checkout.stripe.com/t"));
        var r = service.checkout(1L, 5L);
        assertEquals("https://checkout.stripe.com/t", r.checkoutUrl());
        assertFalse(r.mock());
        verify(tripMapper, never()).updatePlan(any(), any()); // 等 Webhook 确认付款后才升级
    }

    @Test void stripeRefusesAmountsBelowConfiguredMinimumButCanChargeLifetime() {
        when(stripe.configured()).thenReturn(true);
        freeTrip();
        PaymentService service = service("stripe", 500); // 运营把最低额调高（例如结算币种汇率变化）
        assertFalse(service.canCharge(PaymentService.TRIP_PRO_AMOUNT), "低于配置的最低额");
        assertEquals("BELOW_MINIMUM", service.unavailableReason(PaymentService.TRIP_PRO_AMOUNT));
        BusinessException ex = assertThrows(BusinessException.class, () -> service.checkout(1L, 5L));
        assertEquals("PAYMENT_CHANNEL_UNAVAILABLE", ex.getCode());
        verifyNoInteractions(payments);
        verify(stripe, never()).createCheckout(any(), any(), any(), any(), anyInt(), any(), any(), any());

        assertTrue(service.canCharge(PaymentService.LIFETIME_AMOUNT));
        assertNull(service.unavailableReason(PaymentService.LIFETIME_AMOUNT));
        when(stripe.createCheckout(any(), isNull(), eq("LIFETIME"), any(), eq(100000), eq("CNY"), any(), any())).thenReturn(new StripeGateway.Session("cs_1", "https://checkout.stripe.com/x"));
        var r = service.checkoutLifetime(1L);
        assertEquals("https://checkout.stripe.com/x", r.checkoutUrl());
        assertFalse(r.mock());
        verify(users, never()).grantLifetimePro(any()); // Stripe 模式要等 Webhook 确认付款后才发放
    }

    @Test void mockTripProUpgradesOnlyThatTrip() {
        freeTrip();
        var r = service("mock").checkout(1L, 5L);
        assertTrue(r.mock());
        ArgumentCaptor<PaymentEntity> p = ArgumentCaptor.forClass(PaymentEntity.class);
        verify(payments).insert(p.capture());
        assertEquals("TRIP_PRO", p.getValue().product);
        assertEquals(400, p.getValue().amount);
        verify(tripMapper).updatePlan(5L, "PRO");
        verify(users, never()).grantLifetimePro(any());
    }

    @Test void mockLifetimeGrantsAccountAndUpgradesAllTrips() {
        var r = service("mock").checkoutLifetime(1L);
        assertTrue(r.mock());
        ArgumentCaptor<PaymentEntity> p = ArgumentCaptor.forClass(PaymentEntity.class);
        verify(payments).insert(p.capture());
        assertEquals("LIFETIME", p.getValue().product);
        assertNull(p.getValue().tripId);
        assertEquals(100000, p.getValue().amount);
        verify(users).grantLifetimePro(1L);
        verify(tripMapper).upgradeAllOfUser(1L);
    }

    @Test void lifetimeCannotBeBoughtTwice() {
        when(tripMapper.hasLifetimePro(1L)).thenReturn(1);
        BusinessException ex = assertThrows(BusinessException.class, () -> service("mock").checkoutLifetime(1L));
        assertEquals("LIFETIME_ALREADY_OWNED", ex.getCode());
        verifyNoInteractions(payments);
    }
}
