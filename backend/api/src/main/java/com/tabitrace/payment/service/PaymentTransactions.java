package com.tabitrace.payment.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.trip.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import tools.jackson.databind.JsonNode;

import java.time.*;
import java.util.*;

/** Short DB transactions only. Stripe network calls must remain outside this bean. */
@Service
public class PaymentTransactions {
    private final PaymentMapper mapper;
    private final TripService trips;
    private final MembershipService memberships;

    public PaymentTransactions(PaymentMapper mapper, TripService trips, MembershipService memberships) {
        this.mapper = mapper; this.trips = trips; this.memberships = memberships;
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public PaymentEntity prepare(Long userId, Long tripId, String product, int amount, String provider) {
        if (mapper.lockUser(userId) == null) throw new BusinessException("USER_NOT_FOUND", "账号不存在", HttpStatus.NOT_FOUND);
        if (tripId != null && "PRO".equals(trips.requireOwned(userId, tripId).planType))
            throw new BusinessException("TRIP_ALREADY_PRO", "当前旅行已经是 Pro");
        if (tripId == null && tripsLifetime(userId)) throw new BusinessException("LIFETIME_ALREADY_OWNED", "你已经拥有终身 Pro");
        PaymentEntity pending = mapper.pendingByUser(userId);
        if (pending != null) {
            if (Objects.equals(tripId, pending.tripId) && product.equals(pending.product)
                    && provider.equals(pending.provider) && Objects.equals(amount, pending.amount)) return pending;
            throw new BusinessException("PAYMENT_IN_PROGRESS", "你还有未完成的订单，请先在付款记录中继续付款或关闭原订单", HttpStatus.CONFLICT,
                    Map.of("paymentId", pending.id));
        }
        PaymentEntity p = new PaymentEntity();
        p.userId = userId; p.tripId = tripId; p.orderUserId = userId; p.orderTripId = tripId;
        p.product = product; p.amount = amount; p.currency = "CNY"; p.provider = provider;
        p.status = "PENDING"; p.refundedAmount = 0; p.checkoutKey = "user:" + userId;
        p.createdAt = LocalDateTime.now(ZoneOffset.UTC);
        mapper.insert(p);
        return p;
    }

    // Use the same materialized account flag as the rest of the application.
    private boolean tripsLifetime(Long userId) { return mapper.hasLifetime(userId) > 0; }

    public PaymentEntity owned(Long userId, Long paymentId) {
        PaymentEntity p = mapper.findById(paymentId);
        if (p == null || !userId.equals(p.userId)) throw new BusinessException("PAYMENT_NOT_FOUND", "付款记录不存在", HttpStatus.NOT_FOUND);
        return p;
    }

    public void requireTrip(Long userId, Long tripId) { trips.requireOwned(userId, tripId); }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public PaymentEntity beginCreation(Long id) {
        PaymentEntity p=locked(id);
        if (p.providerPaymentId != null) return p;
        if (!"PENDING".equals(p.status)) throw new BusinessException("PAYMENT_NOT_PENDING", "订单已结束", HttpStatus.CONFLICT);
        p.checkoutAttempts++; mapper.update(p); return p;
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void rejectCreation(Long id) {
        PaymentEntity p = locked(id);
        // Only a definite channel rejection may release an order whose Session was never bound.
        if ("PENDING".equals(p.status) && p.providerPaymentId == null && p.checkoutAttempts == 1) {
            p.status="FAILED"; p.checkoutKey=null; mapper.update(p);
        }
    }

    private PaymentEntity locked(Long id) {
        PaymentEntity initial = mapper.findById(id);
        if (initial == null) throw new BusinessException("PAYMENT_NOT_FOUND", "付款记录不存在", HttpStatus.NOT_FOUND);
        if (initial.userId != null) mapper.lockUser(initial.userId);
        return mapper.lock(id);
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public PaymentEntity mockPaid(Long id) {
        PaymentEntity p = locked(id);
        if (!"MOCK".equals(p.provider)) throw mismatch();
        if ("PENDING".equals(p.status)) {
            p.providerPaymentId = "mock_" + p.id; p.status = "PAID"; p.checkoutKey = null;
            p.paidAt = LocalDateTime.now(ZoneOffset.UTC); mapper.update(p); recompute(p);
        }
        return p;
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public PaymentEntity apply(Long id, JsonNode session, JsonNode dispute, String eventId, String eventType) {
        PaymentEntity p = locked(id);
        validate(p, session);
        if (eventId != null && mapper.recordEvent(eventId, id, eventType) == 0) return p;
        p.providerPaymentId = session.path("id").asText();
        p.checkoutUrl = session.path("url").isTextual() ? session.path("url").asText() : null;
        if (session.path("expires_at").canConvertToLong())
            p.expiresAt = LocalDateTime.ofInstant(Instant.ofEpochSecond(session.path("expires_at").asLong()), ZoneOffset.UTC);
        JsonNode intent = session.path("payment_intent"), charge = intent.path("latest_charge");
        if (intent.isObject()) {
            String intentId = intent.path("id").asText();
            if (p.paymentIntentId != null && !p.paymentIntentId.equals(intentId)) throw mismatch();
            p.paymentIntentId = intentId;
        }
        if (charge.isObject()) {
            if (charge.path("amount").asInt(-1) != p.amount || !p.currency.equalsIgnoreCase(charge.path("currency").asText())) throw mismatch();
            p.chargeId = charge.path("id").asText();
            int refunded = charge.path("amount_refunded").asInt(0);
            if (refunded < 0 || refunded > p.amount) throw mismatch();
            p.refundedAmount = Math.max(p.refundedAmount == null ? 0 : p.refundedAmount, refunded);
        }
        if (dispute != null && !dispute.isNull() && !dispute.isMissingNode()) {
            if (!Objects.equals(p.chargeId, reference(dispute.path("charge")))) throw mismatch();
            String state = dispute.path("status").asText();
            // A delayed in-flight snapshot may never reopen a resolved dispute.
            if (p.disputeStatus == null || !Set.of("won", "lost", "warning_closed").contains(p.disputeStatus)) {
                p.disputeId = dispute.path("id").asText(); p.disputeStatus = state;
            }
        }
        boolean paid = "paid".equals(session.path("payment_status").asText());
        if (paid && (!intent.isObject() || !charge.isObject() || !charge.path("paid").asBoolean(false))) throw mismatch();
        if (paid && p.paidAt == null) p.paidAt = LocalDateTime.now(ZoneOffset.UTC);
        if (p.refundedAmount >= p.amount) p.status = "REFUNDED";
        else if (p.disputeStatus != null && !Set.of("won", "warning_closed").contains(p.disputeStatus)) p.status = "DISPUTED";
        else if (paid || p.paidAt != null) p.status = p.refundedAmount > 0 ? "PARTIALLY_REFUNDED" : "PAID";
        else if ("expired".equals(session.path("status").asText())) p.status = "EXPIRED";
        else if (Set.of("canceled", "requires_payment_method").contains(intent.path("status").asText())
                && "complete".equals(session.path("status").asText())) p.status = "FAILED";
        // A returned cancel URL does not prove the Checkout session is closed.
        if (!"PENDING".equals(p.status)) p.checkoutKey = null;
        p.lastSyncedAt = LocalDateTime.now(ZoneOffset.UTC);
        p.lastCheckedAt = p.lastSyncedAt;
        mapper.update(p); recompute(p);
        return p;
    }

    private void recompute(PaymentEntity p) {
        if (p.userId == null) return;
        mapper.recomputeLifetime(p.userId);
        mapper.recomputeTrips(p.userId);
        mapper.syncMemberships(p.userId);
        if ("LIFETIME".equals(p.product) && Set.of("PAID", "PARTIALLY_REFUNDED").contains(p.status))
            memberships.grantLifetime(p.userId, p.id);
    }

    static void validate(PaymentEntity p, JsonNode s) {
        if (!"STRIPE".equals(p.provider) || !"payment".equals(s.path("mode").asText())
                || !s.path("id").asText().startsWith("cs_")
                || (p.providerPaymentId != null && !p.providerPaymentId.equals(s.path("id").asText()))
                || s.path("amount_total").asInt(-1) != p.amount
                || !p.currency.equalsIgnoreCase(s.path("currency").asText())
                || !String.valueOf(p.id).equals(s.path("metadata").path("payment_id").asText())
                || !p.product.equals(s.path("metadata").path("product").asText())
                || (p.orderTripId != null && !p.orderTripId.toString().equals(s.path("metadata").path("trip_id").asText()))) throw mismatch();
    }

    static String reference(JsonNode n) { return n.isTextual() ? n.asText() : n.path("id").asText(); }
    static BusinessException mismatch() { return new BusinessException("PAYMENT_MISMATCH", "付款信息与订单不一致，请联系客服核实", HttpStatus.CONFLICT); }
}
