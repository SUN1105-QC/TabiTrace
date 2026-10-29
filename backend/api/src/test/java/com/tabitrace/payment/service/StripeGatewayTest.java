package com.tabitrace.payment.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.entity.PaymentEntity;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StripeGatewayTest {
    final String secret="whsec_test_only";
    final ObjectMapper json=new ObjectMapper();
    String signed(String body,long ts) throws Exception {
        Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal((ts+"."+body).getBytes(StandardCharsets.UTF_8)));
    }
    @Test void acceptsAnyValidRotationSignatureRegardlessOfOrder() throws Exception {
        StripeGateway s=new StripeGateway("sk_test",secret,json);
        long ts=Instant.now().getEpochSecond(); String body="{\"id\":\"evt_1\"}";
        for(String header:new String[]{"t="+ts+",v1="+signed(body,ts)+",v1=bad", "t="+ts+",v1=bad,v1="+signed(body,ts)})
            assertEquals("evt_1",s.verifyWebhook(body,header).path("id").asText());
    }
    @Test void rejectsExpiredFutureAndTamperedSignatures() throws Exception {
        StripeGateway s=new StripeGateway("sk_test",secret,json); String body="{}"; long now=Instant.now().getEpochSecond();
        for(long ts:new long[]{now-400,now+400}) {
            String header="t="+ts+",v1="+signed(body,ts);
            assertThrows(BusinessException.class,()->s.verifyWebhook(body,header));
        }
        String header="t="+now+",v1="+signed(body,now);
        assertThrows(BusinessException.class,()->s.verifyWebhook("{\"changed\":true}",header));
        assertThrows(BusinessException.class,()->s.verifyWebhook(body,null));
    }
    @SuppressWarnings("unchecked")
    @Test void checkoutRetriesUseSameStripeIdempotencyKey() throws Exception {
        HttpClient http=mock(HttpClient.class); HttpResponse<String> response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200); when(response.body()).thenReturn("{\"id\":\"cs_12\"}");
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        StripeGateway s=new StripeGateway("sk_test",secret,json,http);
        PaymentEntity p=new PaymentEntity(); p.id=12L; p.orderTripId=5L; p.product="TRIP_PRO"; p.amount=400; p.currency="CNY";
        s.createCheckout(p,"https://tabi.example"); s.createCheckout(p,"https://tabi.example");
        ArgumentCaptor<HttpRequest> req=ArgumentCaptor.forClass(HttpRequest.class);
        verify(http,times(2)).send(req.capture(),any(HttpResponse.BodyHandler.class));
        for(HttpRequest r:req.getAllValues()) {
            assertEquals("tabitrace-checkout-12",r.headers().firstValue("Idempotency-Key").orElseThrow());
            assertEquals("/v1/checkout/sessions",r.uri().getPath());
        }
    }
}
