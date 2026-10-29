package com.tabitrace.payment.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.dto.PaymentDtos.*;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.*;
import java.util.*;

@Service
public class PaymentService {
    public static final String PRODUCT_TRIP_PRO = "TRIP_PRO", PRODUCT_LIFETIME = "LIFETIME";
    public static final int TRIP_PRO_AMOUNT = 400, LIFETIME_AMOUNT = 100000;
    public static final String TRIP_PRO_CURRENCY = "CNY";
    /** Local guard only. Stripe's actual minimum depends on settlement currency. */
    public static final int DEFAULT_STRIPE_MIN_AMOUNT = 400;
    private static final Set<String> SESSION_EVENTS = Set.of("checkout.session.completed", "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed", "checkout.session.expired");
    private final PaymentMapper mapper;
    private final PaymentTransactions tx;
    private final StripeGateway stripe;
    private final String mode, publicUrl;
    private final int stripeMinAmount;

    public PaymentService(PaymentMapper mapper, PaymentTransactions tx, StripeGateway stripe,
                          @Value("${app.payments.mode:mock}") String mode,
                          @Value("${app.public-url:http://localhost:3000}") String publicUrl,
                          @Value("${app.payments.stripe.min-amount:400}") int stripeMinAmount) {
        if (!Set.of("mock", "stripe").contains(mode.toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("Unknown payment mode");
        this.mapper = mapper; this.tx = tx; this.stripe = stripe; this.mode = mode;
        this.publicUrl = publicUrl.replaceAll("/$", ""); this.stripeMinAmount = stripeMinAmount;
    }

    public boolean realPayments() { return "stripe".equalsIgnoreCase(mode); }
    public boolean paymentsAvailable() { return !realPayments() || stripe.configured(); }
    public boolean canCharge(int amount) { return paymentsAvailable() && (!realPayments() || amount >= stripeMinAmount); }
    public String unavailableReason(int amount) { return !paymentsAvailable() ? "NOT_CONFIGURED" : canCharge(amount) ? null : "BELOW_MINIMUM"; }
    public boolean hasLifetime(Long userId) { return mapper.hasLifetime(userId) > 0; }

    public CheckoutResponse checkout(Long userId, Long tripId) {
        return start(userId, tripId, PRODUCT_TRIP_PRO, TRIP_PRO_AMOUNT);
    }
    public CheckoutResponse checkoutLifetime(Long userId) {
        return start(userId, null, PRODUCT_LIFETIME, LIFETIME_AMOUNT);
    }

    private CheckoutResponse start(Long userId, Long tripId, String product, int amount) {
        requireChargeable(amount);
        // Reconcile before deciding whether an existing order is still payable.
        PaymentEntity pending = mapper.pendingByUser(userId);
        if (pending != null && pending.providerPaymentId != null && "STRIPE".equals(pending.provider)) reconcile(pending.id);
        PaymentEntity p = tx.prepare(userId, tripId, product, amount, realPayments() ? "STRIPE" : "MOCK");
        return open(p);
    }

    public CheckoutResponse resume(Long userId, Long id) {
        PaymentEntity p = tx.owned(userId, id);
        requireChargeable(p.amount);
        if (!"PENDING".equals(p.status)) throw new BusinessException("PAYMENT_NOT_PENDING", "这笔订单已结束，请查看付款记录", HttpStatus.CONFLICT);
        if ("STRIPE".equals(p.provider) != realPayments()) throw PaymentTransactions.mismatch();
        return open(p);
    }

    private CheckoutResponse open(PaymentEntity p) {
        if ("MOCK".equals(p.provider)) {
            PaymentEntity paid = tx.mockPaid(p.id);
            String query = PRODUCT_LIFETIME.equals(p.product) ? "plan=lifetime" : "trip=" + p.tripId;
            return new CheckoutResponse(p.id, paid.status, publicUrl + "/pricing?" + query + "&order=" + p.id + "&mockPayment=success", true);
        }
        JsonNode session;
        if (p.providerPaymentId != null) session = stripe.checkout(p.providerPaymentId);
        else {
            // Stripe may prune idempotency keys after 24h. Never silently create a second Session.
            if (p.createdAt != null && p.createdAt.isBefore(LocalDateTime.now(ZoneOffset.UTC).minusHours(23)))
                throw new BusinessException("PAYMENT_REVIEW_REQUIRED", "原订单创建结果尚未确认，请联系客服核实后再付款", HttpStatus.CONFLICT);
            session = createSession(p);
        }
        PaymentEntity bound = apply(p.id, session, null, null);
        if (!"PENDING".equals(bound.status)) throw new BusinessException("PAYMENT_NOT_PENDING", "这笔订单已结束，请查看付款记录", HttpStatus.CONFLICT);
        if (!"open".equals(session.path("status").asText()) || bound.checkoutUrl == null)
            throw new BusinessException("PAYMENT_PROCESSING", "原订单正在确认中，请在付款记录中查询结果", HttpStatus.CONFLICT);
        return new CheckoutResponse(p.id, bound.status, bound.checkoutUrl, false);
    }

    public PaymentView latest(Long userId, Long tripId) {
        // Ownership remains mandatory even if there is no payment record.
        tx.requireTrip(userId, tripId);
        PaymentEntity p = mapper.latestByTrip(tripId);
        return p == null ? null : view(p);
    }
    public PaymentView latestLifetime(Long userId) { PaymentEntity p = mapper.latestLifetime(userId); return p == null ? null : view(p); }
    public List<PaymentView> history(Long userId) { return mapper.history(userId).stream().map(PaymentService::view).toList(); }
    public PaymentView get(Long userId, Long id) { return view(tx.owned(userId, id)); }

    /** User-triggered refresh is rate-limited and never issues a charge or refund. */
    public PaymentView refresh(Long userId, Long id) {
        PaymentEntity p = tx.owned(userId, id);
        if ("STRIPE".equals(p.provider) && mapper.claimRefresh(id) == 1)
            p = reconcile(p.id);
        return view(p);
    }

    public PaymentView cancel(Long userId, Long id) {
        PaymentEntity p = tx.owned(userId, id);
        if (!"PENDING".equals(p.status)) return view(p);
        if (!"STRIPE".equals(p.provider) || p.providerPaymentId == null)
            throw new BusinessException("PAYMENT_REVIEW_REQUIRED", "原订单尚待核实，请先查询结果", HttpStatus.CONFLICT);
        JsonNode session = stripe.checkout(p.providerPaymentId);
        if ("open".equals(session.path("status").asText())) stripe.expire(p.providerPaymentId);
        return view(reconcile(p.id));
    }

    public void webhook(String payload, String signature) {
        JsonNode event = stripe.verifyWebhook(payload, signature);
        String type = event.path("type").asText(), eventId = event.path("id").asText();
        boolean disputeEvent = type.startsWith("charge.dispute.");
        if (!SESSION_EVENTS.contains(type) && !"charge.refunded".equals(type) && !disputeEvent) return;
        if (eventId.isBlank()) throw PaymentTransactions.mismatch();
        if (mapper.eventHandled(eventId) > 0) return;
        JsonNode object = event.path("data").path("object"), session;
        if (SESSION_EVENTS.contains(type)) session = stripe.checkout(object.path("id").asText());
        else {
            String intent = PaymentTransactions.reference(object.path("payment_intent"));
            if (intent.isBlank()) throw PaymentTransactions.mismatch();
            session = stripe.sessionForIntent(intent);
        }
        String id = session.path("metadata").path("payment_id").asText();
        // Events belonging to another application on the same Stripe account are ignored.
        if (id.isBlank()) return;
        Long paymentId;
        try { paymentId = Long.valueOf(id); } catch (NumberFormatException e) { throw PaymentTransactions.mismatch(); }
        PaymentEntity p = mapper.findById(paymentId);
        if (p == null) throw new BusinessException("PAYMENT_NOT_FOUND", "付款记录尚未就绪，请重试", HttpStatus.SERVICE_UNAVAILABLE);
        apply(paymentId, session, eventId, type);
    }

    /** Also used by the scheduled repair job; current Stripe state is the source of truth. */
    public PaymentEntity reconcile(Long id) {
        PaymentEntity p = mapper.findById(id);
        if (p == null || !"STRIPE".equals(p.provider)) return p;
        if (p.providerPaymentId == null) {
            if (!"PENDING".equals(p.status)) return p;
            if (p.createdAt == null || p.createdAt.isBefore(LocalDateTime.now(ZoneOffset.UTC).minusHours(23)))
                throw new BusinessException("PAYMENT_REVIEW_REQUIRED", "原订单创建结果尚未确认，请联系客服核实", HttpStatus.CONFLICT);
            return apply(id, createSession(p), null, null);
        }
        return apply(id, stripe.checkout(p.providerPaymentId), null, null);
    }

    private PaymentEntity apply(Long id, JsonNode session, String eventId, String type) {
        JsonNode charge = session.path("payment_intent").path("latest_charge");
        JsonNode dispute = null;
        PaymentEntity p = mapper.findById(id);
        if (p != null && p.disputeId != null) dispute = stripe.dispute(p.disputeId);
        else if (charge.path("disputed").asBoolean(false)) dispute = stripe.disputeForCharge(charge.path("id").asText());
        if (charge.path("disputed").asBoolean(false) && (dispute == null || dispute.isNull()))
            throw new BusinessException("PAYMENT_DISPUTE_UNCONFIRMED", "付款争议尚待确认，请稍后重试", HttpStatus.SERVICE_UNAVAILABLE);
        return tx.apply(id, session, dispute, eventId, type);
    }

    private JsonNode createSession(PaymentEntity p) {
        PaymentEntity attempt=tx.beginCreation(p.id);
        if (attempt.providerPaymentId != null) return stripe.checkout(attempt.providerPaymentId);
        boolean firstAttempt=attempt.checkoutAttempts == 1;
        try { return stripe.createCheckout(attempt, publicUrl); }
        catch (BusinessException e) {
            // A rejection on a retry does not prove an earlier timed-out request created no Session.
            if (firstAttempt && "STRIPE_CHECKOUT_REJECTED".equals(e.getCode())) tx.rejectCreation(p.id);
            throw e;
        }
    }

    private void requireChargeable(int amount) {
        if (!paymentsAvailable()) throw new BusinessException("PAYMENTS_UNAVAILABLE", "支付暂未开放", HttpStatus.SERVICE_UNAVAILABLE);
        if (!canCharge(amount)) throw new BusinessException("PAYMENT_CHANNEL_UNAVAILABLE", "金额低于当前支付渠道配置的最低收款额", HttpStatus.SERVICE_UNAVAILABLE);
    }
    private static PaymentView view(PaymentEntity p) {
        return new PaymentView(p.id, p.tripId, p.product, p.provider, p.providerPaymentId, p.amount, p.currency, p.status,
                p.paidAt, p.createdAt, p.refundedAmount == null ? 0 : p.refundedAmount, p.expiresAt, p.lastSyncedAt);
    }
}
