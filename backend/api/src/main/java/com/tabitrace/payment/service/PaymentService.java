package com.tabitrace.payment.service;

import tools.jackson.databind.JsonNode;
import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.dto.PaymentDtos.*;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * 两种付费（都是一次性付款，不续费、不过期）：
 * - TRIP_PRO：某一段旅行升级为 Trip Pro，¥4
 * - LIFETIME：买断 · 终身 Pro，¥1000 —— 账号下现有与以后新建的所有旅行都是 PRO，并开通永久账号会员（memberships）
 * 金额按最小货币单位（分）存储与提交。Stripe 对单笔金额有最低限制（按结算币种约 ¥3.6 以上），
 * 低于 app.payments.stripe.min-amount 的商品在 Stripe 模式下不可购买，界面提示「需要国内支付渠道」，不会发起注定失败的付款。
 */
@Service
public class PaymentService {
    public static final String PRODUCT_TRIP_PRO = "TRIP_PRO", PRODUCT_LIFETIME = "LIFETIME";
    /** Trip Pro 单次旅行价格：人民币 4 元（400 分），正好不低于 Stripe 单笔最低额，可以直接用 Stripe 收款 */
    public static final int TRIP_PRO_AMOUNT = 400;
    /** 买断 · 终身 Pro：人民币 1000 元（100000 分） */
    public static final int LIFETIME_AMOUNT = 100000;
    public static final String TRIP_PRO_CURRENCY = "CNY";
    /** Stripe 单笔最低收款（分）：官方按结算币种折算，USD 0.50 / HKD 4.00 约合 ¥3.6～3.7，这里取 ¥4.00 留出汇率余量 */
    public static final int DEFAULT_STRIPE_MIN_AMOUNT = 400;

    private final PaymentMapper mapper; private final TripService trips; private final TripMapper tripMapper; private final UserMapper users;
    private final StripeGateway stripe; private final com.tabitrace.membership.service.MembershipService memberships; private final String mode; private final String publicUrl; private final int stripeMinAmount;

    public PaymentService(PaymentMapper mapper, TripService trips, TripMapper tripMapper, UserMapper users, StripeGateway stripe,
                          String mode, String publicUrl, int stripeMinAmount) {
        this(mapper, trips, tripMapper, users, stripe, null, mode, publicUrl, stripeMinAmount);
    }

    @Autowired
    public PaymentService(PaymentMapper mapper, TripService trips, TripMapper tripMapper, UserMapper users, StripeGateway stripe,
                          com.tabitrace.membership.service.MembershipService memberships,
                          @Value("${app.payments.mode:mock}") String mode, @Value("${app.public-url:http://localhost:3000}") String publicUrl,
                          @Value("${app.payments.stripe.min-amount:" + DEFAULT_STRIPE_MIN_AMOUNT + "}") int stripeMinAmount) {
        this.mapper = mapper; this.trips = trips; this.tripMapper = tripMapper; this.users = users; this.stripe = stripe; this.memberships = memberships; this.mode = mode;
        this.publicUrl = publicUrl.replaceAll("/$", ""); this.stripeMinAmount = stripeMinAmount;
    }

    /** 当前支付方式：stripe 为真实付款；其他值为本地模拟支付（不会产生真实扣款） */
    public boolean realPayments() { return "stripe".equalsIgnoreCase(mode); }
    /** 支付通道是否就绪：模拟支付（仅开发）或 Stripe 已完整配置 */
    public boolean paymentsAvailable() { return !realPayments() || stripe.configured(); }
    /** 某个金额能否真正收款：通道就绪，且在 Stripe 模式下不低于 Stripe 的单笔最低额 */
    public boolean canCharge(int amount) { return paymentsAvailable() && (!realPayments() || amount >= stripeMinAmount); }
    /** 不能收款的原因：null（可以收款）/ NOT_CONFIGURED（支付未开放）/ BELOW_MINIMUM（金额低于 Stripe 最低额，需要国内支付渠道） */
    public String unavailableReason(int amount) { return !paymentsAvailable() ? "NOT_CONFIGURED" : canCharge(amount) ? null : "BELOW_MINIMUM"; }
    public boolean hasLifetime(Long userId) { return tripMapper.hasLifetimePro(userId) > 0; }

    @Transactional
    public CheckoutResponse checkout(Long userId, Long tripId) {
        TripEntity t = trips.requireOwned(userId, tripId);
        requireChargeable(TRIP_PRO_AMOUNT, "单次旅行升级的金额低于当前支付渠道的最低收款额，暂时无法购买；可以选择买断终身 Pro");
        if ("PRO".equals(t.planType)) throw new BusinessException("TRIP_ALREADY_PRO", "当前旅行已经是 Pro");
        PaymentEntity p = create(userId, tripId, PRODUCT_TRIP_PRO, TRIP_PRO_AMOUNT);
        if (!realPayments()) { paid(p); return new CheckoutResponse(p.id, p.status, publicUrl + "/trips/" + tripId + "?mockPayment=success", true); }
        var session = stripe.createCheckout(p.id, tripId, PRODUCT_TRIP_PRO, "TabiTrace Trip Pro", p.amount, p.currency,
            publicUrl + "/pricing?trip=" + tripId + "&payment=success", publicUrl + "/pricing?trip=" + tripId + "&payment=cancelled");
        p.providerPaymentId = session.id(); mapper.update(p);
        return new CheckoutResponse(p.id, p.status, session.url(), false);
    }

    /** 买断 · 终身 Pro */
    @Transactional
    public CheckoutResponse checkoutLifetime(Long userId) {
        requireChargeable(LIFETIME_AMOUNT, "当前支付方式暂不支持这笔金额");
        if (hasLifetime(userId)) throw new BusinessException("LIFETIME_ALREADY_OWNED", "你已经拥有终身 Pro");
        PaymentEntity p = create(userId, null, PRODUCT_LIFETIME, LIFETIME_AMOUNT);
        if (!realPayments()) { paid(p); return new CheckoutResponse(p.id, p.status, publicUrl + "/pricing?plan=lifetime&mockPayment=success", true); }
        var session = stripe.createCheckout(p.id, null, PRODUCT_LIFETIME, "TabiTrace 终身 Pro（买断）", p.amount, p.currency,
            publicUrl + "/pricing?plan=lifetime&payment=success", publicUrl + "/pricing?plan=lifetime&payment=cancelled");
        p.providerPaymentId = session.id(); mapper.update(p);
        return new CheckoutResponse(p.id, p.status, session.url(), false);
    }

    public PaymentView latest(Long userId, Long tripId) { trips.requireOwned(userId, tripId); PaymentEntity p = mapper.latestByTrip(tripId); return p == null ? null : view(p); }
    public PaymentView latestLifetime(Long userId) { PaymentEntity p = mapper.latestLifetime(userId); return p == null ? null : view(p); }

    @Transactional
    public void webhook(String payload, String signature) {
        JsonNode event = stripe.verifyWebhook(payload, signature);
        String type = event.path("type").asText();
        if (!"checkout.session.completed".equals(type) && !"checkout.session.async_payment_succeeded".equals(type)) return;
        JsonNode obj = event.path("data").path("object");
        if ("checkout.session.completed".equals(type) && !"paid".equalsIgnoreCase(obj.path("payment_status").asText())) return;
        String paymentIdText = obj.path("metadata").path("payment_id").asText();
        PaymentEntity p = null;
        if (!paymentIdText.isBlank()) try { p = mapper.findById(Long.valueOf(paymentIdText)); } catch (NumberFormatException ignored) {}
        if (p == null) p = mapper.findByProviderId(obj.path("id").asText());
        if (p == null || "PAID".equals(p.status)) return;
        p.providerPaymentId = obj.path("id").asText();
        paid(p);
    }

    private void requireChargeable(int amount, String belowMinimumMessage) {
        if (!paymentsAvailable()) throw new BusinessException("PAYMENTS_UNAVAILABLE", "支付暂未开放", HttpStatus.SERVICE_UNAVAILABLE);
        if (!canCharge(amount)) throw new BusinessException("PAYMENT_CHANNEL_UNAVAILABLE", belowMinimumMessage, HttpStatus.SERVICE_UNAVAILABLE);
    }

    private PaymentEntity create(Long userId, Long tripId, String product, int amount) {
        PaymentEntity p = new PaymentEntity();
        p.userId = userId; p.tripId = tripId; p.product = product; p.amount = amount; p.currency = TRIP_PRO_CURRENCY;
        p.provider = realPayments() ? "STRIPE" : "MOCK"; p.status = "PENDING";
        mapper.insert(p);
        return p;
    }

    /** 标记已付款并发放权益：单次 → 这段旅行 PRO；终身 → 账号记下终身 Pro，所有旅行 PRO */
    private void paid(PaymentEntity p) {
        if (p.providerPaymentId == null) p.providerPaymentId = "mock_" + p.id;
        p.status = "PAID"; p.paidAt = LocalDateTime.now(ZoneOffset.UTC);
        mapper.update(p);
        // 账号已注销（付款记录保留、关联已置空）：只记下付款结果，不再发放权益
        if (p.userId == null) return;
        if (PRODUCT_LIFETIME.equals(p.product)) {
            users.grantLifetimePro(p.userId);
            // 终身 Pro 同时开通永久账号会员（自定义音乐等会员权益）
            if (memberships != null) memberships.grantLifetime(p.userId, p.id);
            tripMapper.upgradeAllOfUser(p.userId);
        } else if (p.tripId != null) {
            tripMapper.updatePlan(p.tripId, "PRO");
        }
    }

    private static PaymentView view(PaymentEntity p) {
        return new PaymentView(p.id, p.tripId, p.product == null ? PRODUCT_TRIP_PRO : p.product, p.provider, p.providerPaymentId, p.amount, p.currency, p.status, p.paidAt, p.createdAt);
    }
}
