package com.tabitrace.payment;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.payment.service.PaymentTransactions;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.*;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PaymentLifecycleTest {
    ObjectMapper json=new ObjectMapper();
    PaymentMapper mapper=mock(PaymentMapper.class);
    MembershipService members=mock(MembershipService.class);
    PaymentTransactions tx=new PaymentTransactions(mapper,mock(TripService.class),members);
    PaymentEntity p=new PaymentEntity();
    @BeforeEach void init() {
        p.id=12L; p.userId=1L; p.tripId=5L; p.orderTripId=5L; p.product="TRIP_PRO";
        p.provider="STRIPE"; p.providerPaymentId="cs_12"; p.amount=400; p.currency="CNY"; p.status="PENDING"; p.refundedAmount=0;
        when(mapper.findById(12L)).thenReturn(p); when(mapper.lock(12L)).thenReturn(p);
        when(mapper.recordEvent(anyString(),eq(12L),anyString())).thenReturn(1);
    }
    ObjectNode session() {
        return (ObjectNode)json.readTree("""
          {"id":"cs_12","mode":"payment","status":"complete","payment_status":"paid","amount_total":400,"currency":"cny",
           "metadata":{"payment_id":"12","product":"TRIP_PRO","trip_id":"5"},
           "payment_intent":{"id":"pi_12","status":"succeeded","latest_charge":{"id":"ch_12","amount":400,"currency":"cny","paid":true,"amount_refunded":0}}}
          """);
    }
    void apply(ObjectNode s) { tx.apply(12L,s,null,"evt_12","checkout.session.completed"); }
    @Test void paidIsGrantedOnlyAfterAmountCurrencyProductAndSessionMatch() {
        apply(session()); assertEquals("PAID",p.status); assertNotNull(p.paidAt);
        verify(mapper).recomputeTrips(1L);
    }
    @Test void wrongAmountIsRejectedWithoutWriting() {
        var s=session(); s.put("amount_total",1);
        assertEquals("PAYMENT_MISMATCH",assertThrows(BusinessException.class,()->apply(s)).getCode());
        verify(mapper,never()).update(any());
    }
    @Test void wrongCurrencyProductTripOrSessionAreRejected() {
        for(String field:new String[]{"currency","product","trip_id","id"}) {
            var s=session(); if (field.equals("product")||field.equals("trip_id")) ((ObjectNode)s.path("metadata")).put(field,"wrong");
            else s.put(field,"wrong");
            assertThrows(BusinessException.class,()->apply(s));
        }
        verify(mapper,never()).update(any());
    }
    @Test void paidSessionWithoutExpandedPaidChargeFailsClosed() {
        var s=session(); s.put("payment_intent","pi_12");
        assertThrows(BusinessException.class,()->apply(s)); verify(mapper,never()).update(any());
    }
    @Test void repeatedEventDoesNotRegrantMembership() {
        when(mapper.recordEvent(anyString(),eq(12L),anyString())).thenReturn(0);
        apply(session()); verify(mapper,never()).update(any()); verifyNoInteractions(members);
    }
    @Test void fullRefundRevokesOnlyPaymentDerivedEntitlementsAndCannotBeUndoneByOldSuccess() {
        var s=session(); ((ObjectNode)s.path("payment_intent").path("latest_charge")).put("amount_refunded",400);
        apply(s); assertEquals("REFUNDED",p.status);
        tx.apply(12L,session(),null,null,null); assertEquals("REFUNDED",p.status);
        verify(mapper,times(2)).recomputeTrips(1L);
    }
    @Test void partialRefundKeepsEntitlementStatus() {
        var s=session(); ((ObjectNode)s.path("payment_intent").path("latest_charge")).put("amount_refunded",100);
        apply(s); assertEquals("PARTIALLY_REFUNDED",p.status); assertEquals(100,p.refundedAmount);
    }
    @Test void disputeSuspendsAndWonRestoresEntitlement() {
        var dispute=(ObjectNode)json.readTree("{\"id\":\"dp_12\",\"charge\":\"ch_12\",\"status\":\"needs_response\"}");
        tx.apply(12L,session(),dispute,null,null); assertEquals("DISPUTED",p.status);
        dispute.put("status","won"); tx.apply(12L,session(),dispute,null,null); assertEquals("PAID",p.status);
        dispute.put("status","needs_response"); tx.apply(12L,session(),dispute,null,null); assertEquals("PAID",p.status);
    }
    @Test void expiredOrFailedNeverGrantPro() {
        var s=session(); s.put("payment_status","unpaid"); s.put("status","expired"); s.putNull("payment_intent");
        apply(s); assertEquals("EXPIRED",p.status); assertNull(p.paidAt);
        s.put("status","complete"); var pi=s.putObject("payment_intent"); pi.put("id","pi_12"); pi.put("status","requires_payment_method");
        apply(s); assertEquals("FAILED",p.status); assertNull(p.paidAt); verifyNoInteractions(members);
    }
    @Test void deletedAccountRetainsFinancialStatusWithoutIssuingEntitlements() {
        p.userId=null; apply(session()); assertEquals("PAID",p.status);
        verify(mapper,never()).recomputeLifetime(any()); verify(mapper,never()).recomputeTrips(any());
    }
}
