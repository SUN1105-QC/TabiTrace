package com.tabitrace.payment.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.entity.PaymentEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Component
public class StripeGateway {
    private final String secretKey, webhookSecret;
    private final ObjectMapper json;
    private final HttpClient http;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(StripeGateway.class);

    @org.springframework.beans.factory.annotation.Autowired
    public StripeGateway(@Value("${app.payments.stripe.secret-key:}") String secretKey,
                         @Value("${app.payments.stripe.webhook-secret:}") String webhookSecret, ObjectMapper json) {
        this(secretKey, webhookSecret, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    StripeGateway(String secretKey, String webhookSecret, ObjectMapper json, HttpClient http) {
        this.secretKey = secretKey; this.webhookSecret = webhookSecret; this.json = json; this.http = http;
    }

    public boolean configured() { return !secretKey.isBlank() && !webhookSecret.isBlank(); }

    /** A committed local order is the idempotency boundary, including after an HTTP timeout. */
    public JsonNode createCheckout(PaymentEntity p, String publicUrl) {
        Map<String, String> f = new LinkedHashMap<>();
        String query = "LIFETIME".equals(p.product) ? "plan=lifetime" : "trip=" + p.orderTripId;
        query += "&order=" + p.id;
        f.put("mode", "payment");
        f.put("success_url", publicUrl + "/pricing?" + query + "&payment=success");
        f.put("cancel_url", publicUrl + "/pricing?" + query + "&payment=cancelled");
        f.put("line_items[0][price_data][currency]", p.currency.toLowerCase(Locale.ROOT));
        f.put("line_items[0][price_data][product_data][name]", "LIFETIME".equals(p.product) ? "TabiTrace 终身 Pro（买断）" : "TabiTrace Trip Pro");
        f.put("line_items[0][price_data][unit_amount]", String.valueOf(p.amount));
        f.put("line_items[0][quantity]", "1");
        for (String prefix : List.of("metadata", "payment_intent_data[metadata]")) {
            f.put(prefix + "[payment_id]", String.valueOf(p.id));
            f.put(prefix + "[product]", p.product);
            if (p.orderTripId != null) f.put(prefix + "[trip_id]", p.orderTripId.toString());
        }
        return request("POST", "/checkout/sessions", f, "tabitrace-checkout-" + p.id);
    }

    public JsonNode checkout(String sessionId) {
        return request("GET", "/checkout/sessions/" + segment(sessionId) + "?expand[]=payment_intent.latest_charge", Map.of(), null);
    }

    public JsonNode sessionForIntent(String intentId) {
        JsonNode sessions = request("GET", "/checkout/sessions?payment_intent=" + segment(intentId) + "&limit=1", Map.of(), null);
        if (sessions.path("data").isEmpty()) throw new BusinessException("PAYMENT_SESSION_NOT_FOUND", "渠道付款尚未关联到订单，请稍后重试", HttpStatus.SERVICE_UNAVAILABLE);
        return checkout(sessions.path("data").get(0).path("id").asText());
    }

    public JsonNode expire(String sessionId) {
        return request("POST", "/checkout/sessions/" + segment(sessionId) + "/expire", Map.of(), "tabitrace-expire-" + sessionId);
    }

    /** Fetch current dispute state: webhook delivery order does not define financial state. */
    public JsonNode dispute(String disputeId) {
        return request("GET", "/disputes/" + segment(disputeId), Map.of(), null);
    }

    public JsonNode disputeForCharge(String chargeId) {
        JsonNode list = request("GET", "/disputes?charge=" + segment(chargeId) + "&limit=1", Map.of(), null);
        return list.path("data").isEmpty() ? json.nullNode() : list.path("data").get(0);
    }

    private static String segment(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_]+")) throw new BusinessException("INVALID_PAYMENT_REFERENCE", "支付渠道编号不正确");
        return value;
    }

    private JsonNode request(String method, String path, Map<String, String> fields, String key) {
        if (secretKey.isBlank()) throw new BusinessException("PAYMENTS_UNAVAILABLE", "支付暂未开放", HttpStatus.SERVICE_UNAVAILABLE);
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("https://api.stripe.com/v1" + path))
                    .header("Authorization", "Bearer " + secretKey).timeout(Duration.ofSeconds(15));
            if (key != null) b.header("Idempotency-Key", key);
            if ("POST".equals(method)) b.header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form(fields)));
            else b.GET();
            HttpResponse<String> res = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.warn("PAYMENT: Stripe request failed status={}", res.statusCode());
                String errorType = json.readTree(res.body()).path("error").path("type").asText();
                if ("POST".equals(method) && "/checkout/sessions".equals(path)
                        && Set.of(400,401,403).contains(res.statusCode()) && !"idempotency_error".equals(errorType))
                    throw new BusinessException("STRIPE_CHECKOUT_REJECTED", "支付渠道拒绝创建付款页，请稍后再试或联系客服", HttpStatus.BAD_GATEWAY);
                throw new BusinessException("STRIPE_REQUEST_FAILED", "支付渠道暂时无法确认结果，请稍后重试；请勿重复付款", HttpStatus.BAD_GATEWAY);
            }
            return json.readTree(res.body());
        } catch (BusinessException e) { throw e; }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("STRIPE_REQUEST_FAILED", "支付请求中断，请稍后查询原订单", HttpStatus.BAD_GATEWAY);
        } catch (Exception e) {
            log.warn("PAYMENT: Stripe request failed reason={}", e.getClass().getSimpleName());
            throw new BusinessException("STRIPE_REQUEST_FAILED", "支付结果尚未确认，请稍后查询原订单", HttpStatus.BAD_GATEWAY);
        }
    }

    public JsonNode verifyWebhook(String payload, String signature) {
        if (webhookSecret.isBlank()) throw new BusinessException("STRIPE_WEBHOOK_NOT_CONFIGURED", "Stripe Webhook Secret 未配置");
        try {
            String timestamp = null;
            List<String> signatures = new ArrayList<>();
            for (String field : signature.split(",")) {
                String[] kv = field.trim().split("=", 2);
                if (kv.length != 2) continue;
                if ("t".equals(kv[0])) timestamp = kv[1];
                if ("v1".equals(kv[0])) signatures.add(kv[1]);
            }
            long ts = Long.parseLong(timestamp), now = Instant.now().getEpochSecond();
            if (ts < now - 300 || ts > now + 300 || signatures.isEmpty()) throw new SecurityException();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8));
            boolean valid = false;
            for (String candidate : signatures) {
                try { valid |= MessageDigest.isEqual(expected, HexFormat.of().parseHex(candidate)); }
                catch (IllegalArgumentException ignored) { /* another rotation signature may still match */ }
            }
            if (!valid) throw new SecurityException();
            return json.readTree(payload);
        } catch (Exception e) { throw new BusinessException("INVALID_STRIPE_SIGNATURE", "Stripe Webhook 签名验证失败"); }
    }

    private static String form(Map<String, String> fields) {
        StringJoiner body = new StringJoiner("&");
        fields.forEach((k, v) -> body.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v, StandardCharsets.UTF_8)));
        return body.toString();
    }
}
