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

/** 负责支付渠道交互与对账编排；行锁、订单状态和权益更新交给独立的短事务服务。 */
@Service
public class PaymentService {
    public static final String PRODUCT_TRIP_PRO = "TRIP_PRO", PRODUCT_LIFETIME = "LIFETIME";
    public static final int TRIP_PRO_AMOUNT = 400, LIFETIME_AMOUNT = 100000;
    public static final String TRIP_PRO_CURRENCY = "CNY";
    /** 本地最低金额保护；渠道实际最低金额仍取决于结算币种，不能代替渠道校验。 */
    public static final int DEFAULT_STRIPE_MIN_AMOUNT = 400;
    private static final Set<String> SESSION_EVENTS = Set.of("checkout.session.completed", "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed", "checkout.session.expired");
    private final PaymentMapper mapper;
    private final PaymentTransactions tx;
    private final StripeGateway stripe;
    private final String mode, publicUrl;
    private final int stripeMinAmount;
    /** 全部功能免费开放时不受理新的付款；手动构造（单测）默认关闭 */
    @org.springframework.beans.factory.annotation.Autowired private com.tabitrace.common.PlanAccess planAccess = com.tabitrace.common.PlanAccess.CLOSED;
    public boolean openAccess() { return planAccess.open(); }

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
        // 先向渠道核实已有订单，再判断是否继续付款，避免本地状态滞后导致重复开单。
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
            // 渠道可能在 24 小时后清理幂等键；接近窗口上限且未绑定会话的订单必须人工核实，不能直接再开一次。
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
        // 即使尚无付款记录，也先校验旅行归属，不能通过查询订单绕过旅行权限。
        tx.requireTrip(userId, tripId);
        PaymentEntity p = mapper.latestByTrip(tripId);
        return p == null ? null : view(p);
    }
    public PaymentView latestLifetime(Long userId) { PaymentEntity p = mapper.latestLifetime(userId); return p == null ? null : view(p); }
    public List<PaymentView> history(Long userId) { return mapper.history(userId).stream().map(PaymentService::view).toList(); }
    public PaymentView get(Long userId, Long id) { return view(tx.owned(userId, id)); }

    /** 用户主动刷新只限频对账，不发起新扣款或退款。 */
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
        // 必须先验证渠道签名，再读取事件；后续会回查渠道会话，不直接信任推送中的支付结果。
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
        // 同一渠道账号可能服务多个应用；没有本应用订单标识的事件直接忽略。
        if (id.isBlank()) return;
        Long paymentId;
        try { paymentId = Long.valueOf(id); } catch (NumberFormatException e) { throw PaymentTransactions.mismatch(); }
        PaymentEntity p = mapper.findById(paymentId);
        if (p == null) throw new BusinessException("PAYMENT_NOT_FOUND", "付款记录尚未就绪，请重试", HttpStatus.SERVICE_UNAVAILABLE);
        apply(paymentId, session, eventId, type);
    }

    /** 用户刷新与定时补偿共用对账流程，以渠道当前状态为准修复本地记录。 */
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
            // 重试被拒绝也不能证明先前超时请求未创建会话，不能据此直接释放原订单。
            if (firstAttempt && "STRIPE_CHECKOUT_REJECTED".equals(e.getCode())) tx.rejectCreation(p.id);
            throw e;
        }
    }

    private void requireChargeable(int amount) {
        if (planAccess.open()) throw new BusinessException("PLANS_OPEN_ACCESS", "当前全部功能免费开放，无需购买", HttpStatus.CONFLICT);
        if (!paymentsAvailable()) throw new BusinessException("PAYMENTS_UNAVAILABLE", "支付暂未开放", HttpStatus.SERVICE_UNAVAILABLE);
        if (!canCharge(amount)) throw new BusinessException("PAYMENT_CHANNEL_UNAVAILABLE", "金额低于当前支付渠道配置的最低收款额", HttpStatus.SERVICE_UNAVAILABLE);
    }
    private static PaymentView view(PaymentEntity p) {
        return new PaymentView(p.id, p.tripId, p.product, p.provider, p.providerPaymentId, p.amount, p.currency, p.status,
                p.paidAt, p.createdAt, p.refundedAmount == null ? 0 : p.refundedAmount, p.expiresAt, p.lastSyncedAt);
    }
}
