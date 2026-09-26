package com.tabitrace.payment.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.tabitrace.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class StripeGateway {
    private final String secretKey;private final String webhookSecret;private final ObjectMapper json;private final HttpClient http=HttpClient.newHttpClient();
    public StripeGateway(@Value("${app.payments.stripe.secret-key:}") String secretKey,@Value("${app.payments.stripe.webhook-secret:}") String webhookSecret,ObjectMapper json){this.secretKey=secretKey;this.webhookSecret=webhookSecret;this.json=json;}
    /** amount 为最小货币单位（人民币为「分」），currency 为 ISO 币种代码 */
    public Session createCheckout(Long paymentId,Long tripId,int amount,String currency,String successUrl,String cancelUrl){if(secretKey.isBlank())throw new BusinessException("STRIPE_NOT_CONFIGURED","Stripe Secret Key 未配置");try{Map<String,String> f=new LinkedHashMap<>();f.put("mode","payment");f.put("success_url",successUrl);f.put("cancel_url",cancelUrl);f.put("line_items[0][price_data][currency]",currency.toLowerCase());f.put("line_items[0][price_data][product_data][name]","TabiTrace Trip Pro");f.put("line_items[0][price_data][unit_amount]",String.valueOf(amount));f.put("line_items[0][quantity]","1");f.put("metadata[payment_id]",String.valueOf(paymentId));f.put("metadata[trip_id]",String.valueOf(tripId));String body=form(f);HttpRequest req=HttpRequest.newBuilder(URI.create("https://api.stripe.com/v1/checkout/sessions")).header("Authorization","Bearer "+secretKey).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build();HttpResponse<String> res=http.send(req,HttpResponse.BodyHandlers.ofString());if(res.statusCode()/100!=2)throw new BusinessException("STRIPE_CHECKOUT_FAILED","Stripe Checkout 创建失败: "+res.body());JsonNode n=json.readTree(res.body());return new Session(n.path("id").asText(),n.path("url").asText());}catch(BusinessException e){throw e;}catch(Exception e){throw new BusinessException("STRIPE_CHECKOUT_FAILED","Stripe Checkout 创建失败");}}
    public JsonNode verifyWebhook(String payload,String signature){if(webhookSecret.isBlank())throw new BusinessException("STRIPE_WEBHOOK_NOT_CONFIGURED","Stripe Webhook Secret 未配置");try{Map<String,String> parts=new HashMap<>();for(String p:signature.split(",")){String[] kv=p.split("=",2);if(kv.length==2)parts.put(kv[0],kv[1]);}String ts=parts.get("t"),sig=parts.get("v1");if(ts==null||sig==null)throw new SecurityException();long age=Math.abs(Instant.now().getEpochSecond()-Long.parseLong(ts));if(age>300)throw new SecurityException();Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));String expected=HexFormat.of().formatHex(mac.doFinal((ts+"."+payload).getBytes(StandardCharsets.UTF_8)));if(!java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),sig.getBytes(StandardCharsets.UTF_8)))throw new SecurityException();return json.readTree(payload);}catch(Exception e){throw new BusinessException("INVALID_STRIPE_SIGNATURE","Stripe Webhook 签名验证失败");}}
    private static String form(Map<String,String> m){StringBuilder b=new StringBuilder();m.forEach((k,v)->{if(!b.isEmpty())b.append('&');b.append(URLEncoder.encode(k,StandardCharsets.UTF_8)).append('=').append(URLEncoder.encode(v,StandardCharsets.UTF_8));});return b.toString();}
    public record Session(String id,String url){}
}
