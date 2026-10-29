package com.tabitrace.payment;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.payment.service.*;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.*;
import tools.jackson.databind.ObjectMapper;

import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaymentAvailabilityTest {
    PaymentMapper mapper = mock(PaymentMapper.class);
    TripService trips = mock(TripService.class);
    MembershipService memberships = mock(MembershipService.class);
    StripeGateway stripe = mock(StripeGateway.class);
    PaymentTransactions tx = new PaymentTransactions(mapper, trips, memberships);
    ObjectMapper json = new ObjectMapper();

    @BeforeEach void setup() {
        when(mapper.lockUser(1L)).thenReturn(1L);
        TripEntity t = new TripEntity(); t.id=5L; t.userId=1L; t.planType="FREE";
        when(trips.requireOwned(1L,5L)).thenReturn(t);
        doAnswer(i -> {
            PaymentEntity p=i.getArgument(0); p.id=12L;
            when(mapper.findById(12L)).thenReturn(p); when(mapper.lock(12L)).thenReturn(p);
            return 1;
        }).when(mapper).insert(any());
    }
    PaymentService service(String mode, int min) { return new PaymentService(mapper,tx,stripe,mode,"https://tabi.example",min); }
    PaymentService service(String mode) { return service(mode,400); }

    @Test void pricesRemainFourAndOneThousandYuan() {
        assertEquals(400,PaymentService.TRIP_PRO_AMOUNT); assertEquals(100000,PaymentService.LIFETIME_AMOUNT);
        assertEquals("CNY",PaymentService.TRIP_PRO_CURRENCY);
    }
    @Test void unavailableStripeDoesNotWriteOrders() {
        BusinessException e=assertThrows(BusinessException.class,()->service("stripe").checkout(1L,5L));
        assertEquals("PAYMENTS_UNAVAILABLE",e.getCode()); verify(mapper,never()).insert(any());
    }
    @Test void configurableMinimumBlocksSmallProductOnly() {
        when(stripe.configured()).thenReturn(true);
        assertFalse(service("stripe",500).canCharge(400)); assertTrue(service("stripe",500).canCharge(100000));
        assertEquals("PAYMENT_CHANNEL_UNAVAILABLE",assertThrows(BusinessException.class,()->service("stripe",500).checkout(1L,5L)).getCode());
        verify(mapper,never()).insert(any());
    }
    @Test void checkoutPersistsOrderBeforeStripeAndDoesNotPrematurelyGrant() {
        when(stripe.configured()).thenReturn(true);
        when(stripe.createCheckout(any(),any())).thenReturn(json.readTree("""
          {"id":"cs_12","mode":"payment","status":"open","payment_status":"unpaid","amount_total":400,"currency":"cny",
          "url":"https://checkout.stripe.com/c/pay/cs_12","metadata":{"payment_id":"12","product":"TRIP_PRO","trip_id":"5"}}
          """));
        var result=service("stripe").checkout(1L,5L);
        assertFalse(result.mock()); assertEquals("PENDING",result.status());
        var order=inOrder(mapper,stripe); order.verify(mapper).insert(any()); order.verify(stripe).createCheckout(any(),any());
        verify(memberships,never()).grantLifetime(any(),any());
        assertNull(mapper.findById(12L).paidAt);
    }
    @Test void networkFailureKeepsDurableOrderForRetry() {
        when(stripe.configured()).thenReturn(true);
        when(stripe.createCheckout(any(),any())).thenThrow(new BusinessException("NETWORK","retry"));
        assertThrows(BusinessException.class,()->service("stripe").checkout(1L,5L));
        PaymentEntity p=mapper.findById(12L);
        assertEquals("PENDING",p.status); assertEquals("user:1",p.checkoutKey); assertNull(p.providerPaymentId);
    }
    @Test void mockTripPaymentUsesRecomputedEntitlements() {
        var result=service("mock").checkout(1L,5L);
        assertTrue(result.mock()); assertEquals("PAID",result.status()); assertNull(mapper.findById(12L).checkoutKey);
        verify(mapper).recomputeTrips(1L); verify(memberships,never()).grantLifetime(any(),any());
    }
    @Test void definiteChannelRejectionReleasesPendingOrderButNetworkErrorsDoNot() {
        when(stripe.configured()).thenReturn(true);
        when(stripe.createCheckout(any(),any())).thenThrow(new BusinessException("STRIPE_CHECKOUT_REJECTED","rejected"));
        assertThrows(BusinessException.class,()->service("stripe").checkout(1L,5L));
        assertEquals("FAILED",mapper.findById(12L).status); assertNull(mapper.findById(12L).checkoutKey);
    }
    @Test void rejectedRetryCannotDiscardAnEarlierUnknownSession() {
        PaymentEntity pending=tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE"); pending.checkoutAttempts=1;
        when(mapper.pendingByUser(1L)).thenReturn(pending); when(stripe.configured()).thenReturn(true);
        when(stripe.createCheckout(any(),any())).thenThrow(new BusinessException("STRIPE_CHECKOUT_REJECTED","rejected"));
        assertThrows(BusinessException.class,()->service("stripe").checkout(1L,5L));
        assertEquals("PENDING",pending.status); assertNotNull(pending.checkoutKey);
    }
    @Test void mockLifetimeAlsoGrantsMembership() {
        var result=service("mock").checkoutLifetime(1L);
        assertTrue(result.mock()); verify(mapper).recomputeLifetime(1L); verify(mapper).recomputeTrips(1L);
        verify(memberships).grantLifetime(1L,12L);
    }
    @Test void lifetimeCannotBeBoughtAfterItIsOwned() {
        when(mapper.hasLifetime(1L)).thenReturn(1);
        assertEquals("LIFETIME_ALREADY_OWNED",assertThrows(BusinessException.class,()->service("mock").checkoutLifetime(1L)).getCode());
        verify(mapper,never()).insert(any());
    }
    @Test void pendingOrderIsReusedAcrossRetries() {
        PaymentEntity p=tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE");
        when(mapper.pendingByUser(1L)).thenReturn(p);
        assertSame(p,tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE"));
        verify(mapper,times(1)).insert(any());
    }
    @Test void pendingTripBlocksConcurrentLifetimePurchase() {
        PaymentEntity pending=tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE");
        when(mapper.pendingByUser(1L)).thenReturn(pending);
        assertEquals("PAYMENT_IN_PROGRESS",assertThrows(BusinessException.class,()->tx.prepare(1L,null,"LIFETIME",100000,"STRIPE")).getCode());
        verify(mapper,times(1)).insert(any());
    }
    @Test void lostResponseAfterIdempotencyWindowRequiresReview() {
        PaymentEntity p=tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE"); p.createdAt=LocalDateTime.now(ZoneOffset.UTC).minusDays(2);
        when(mapper.pendingByUser(1L)).thenReturn(p); when(stripe.configured()).thenReturn(true);
        assertEquals("PAYMENT_REVIEW_REQUIRED",assertThrows(BusinessException.class,()->service("stripe").checkout(1L,5L)).getCode());
        verify(stripe,never()).createCheckout(any(),any());
    }
    @Test void otherUsersCannotQueryRefreshCancelOrResumeAnOrder() {
        tx.prepare(1L,5L,"TRIP_PRO",400,"STRIPE");
        assertThrows(BusinessException.class,()->service("stripe").get(2L,12L));
        assertThrows(BusinessException.class,()->service("stripe").refresh(2L,12L));
        assertThrows(BusinessException.class,()->service("stripe").cancel(2L,12L));
        assertThrows(BusinessException.class,()->service("stripe").resume(2L,12L));
        verifyNoInteractions(stripe);
    }
    @Test void unknownModeCannotSilentlyBecomeMock() {
        assertThrows(IllegalArgumentException.class,()->service("strpie"));
    }
}
