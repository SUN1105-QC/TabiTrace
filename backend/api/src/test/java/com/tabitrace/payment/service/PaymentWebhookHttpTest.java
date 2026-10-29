package com.tabitrace.payment.service;

import com.tabitrace.common.GlobalExceptionHandler;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.controller.PaymentController;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP body -> real HMAC verification -> Stripe protocol stub -> real lifecycle logic. No Stripe charges. */
class PaymentWebhookHttpTest {
    final ObjectMapper json=new ObjectMapper();
    final PaymentMapper mapper=mock(PaymentMapper.class);
    final HttpClient http=mock(HttpClient.class);
    final String secret="whsec_http_test_only";
    final Set<String> receipts=new HashSet<>();
    PaymentEntity p;
    ObjectNode session;
    MockMvc mvc;
    @BeforeEach @SuppressWarnings("unchecked") void setup() throws Exception {
        p=new PaymentEntity();p.id=12L;p.userId=1L;p.tripId=5L;p.orderTripId=5L;p.product="TRIP_PRO";p.provider="STRIPE";
        p.providerPaymentId="cs_12";p.amount=400;p.currency="CNY";p.status="PENDING";p.refundedAmount=0;
        when(mapper.findById(12L)).thenReturn(p);when(mapper.lock(12L)).thenReturn(p);when(mapper.lockUser(1L)).thenReturn(1L);
        when(mapper.eventHandled(anyString())).thenAnswer(i->receipts.contains(i.getArgument(0))?1:0);
        when(mapper.recordEvent(anyString(),eq(12L),anyString())).thenAnswer(i->receipts.add(i.getArgument(0))?1:0);
        session=(ObjectNode)json.readTree("""
          {"id":"cs_12","mode":"payment","status":"complete","payment_status":"paid","amount_total":400,"currency":"cny",
           "metadata":{"payment_id":"12","product":"TRIP_PRO","trip_id":"5"},
           "payment_intent":{"id":"pi_12","status":"succeeded","latest_charge":{"id":"ch_12","amount":400,"currency":"cny","paid":true,"amount_refunded":0}}}
          """);
        when(http.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenAnswer(i->{
            HttpRequest request=i.getArgument(0);HttpResponse<String> response=mock(HttpResponse.class);
            when(response.statusCode()).thenReturn(200);
            when(response.body()).thenReturn(request.uri().getPath().equals("/v1/checkout/sessions") ? "{\"data\":[{\"id\":\"cs_12\"}]}" : session.toString());
            return response;
        });
        StripeGateway stripe=new StripeGateway("sk_test_http_stub",secret,json,http);
        PaymentTransactions tx=new PaymentTransactions(mapper,mock(TripService.class),mock(MembershipService.class));
        PaymentService payments=new PaymentService(mapper,tx,stripe,"stripe","https://tabi.example",400);
        mvc=MockMvcBuilders.standaloneSetup(new PaymentController(payments)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    String signature(String body) throws Exception {
        long ts=Instant.now().getEpochSecond();Mac hmac=Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return "t="+ts+",v1="+HexFormat.of().formatHex(hmac.doFinal((ts+"."+body).getBytes(StandardCharsets.UTF_8)));
    }
    ResultActions deliver(String body) throws Exception {
        return mvc.perform(post("/api/v1/payments/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                .header("Stripe-Signature",signature(body)).content(body.getBytes(StandardCharsets.UTF_8)));
    }
    @Test void signedUtf8HttpEventGrantsOnceAndDuplicateAcknowledgementDoesNotCallStripeAgain() throws Exception {
        String body="{\"id\":\"evt_http\",\"type\":\"checkout.session.completed\",\"note\":\"旅行付款\",\"data\":{\"object\":{\"id\":\"cs_12\"}}}";
        deliver(body).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        assertEquals("PAID",p.status);deliver(body).andExpect(status().isOk());
        verify(http,times(1)).send(any(HttpRequest.class),any());verify(mapper,times(1)).recomputeTrips(1L);
    }
    @Test void invalidHttpSignatureIsRejectedBeforeAnyChannelRequest() throws Exception {
        mvc.perform(post("/api/v1/payments/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                .header("Stripe-Signature","t=0,v1=invalid").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRIPE_SIGNATURE"));
        verifyNoInteractions(http);verify(mapper,never()).update(any());
    }
    @Test void validSignatureDoesNotOverrideWrongOrderAmount() throws Exception {
        session.put("amount_total",1);
        deliver("{\"id\":\"evt_wrong\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"id\":\"cs_12\"}}}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_MISMATCH"));
        assertEquals("PENDING",p.status);verify(mapper,never()).recomputeTrips(any());
    }
    @Test void refundHttpEventResolvesIntentToCheckoutAndRevokesPaymentDerivedEntitlement() throws Exception {
        ((ObjectNode)session.path("payment_intent").path("latest_charge")).put("amount_refunded",400);
        deliver("{\"id\":\"evt_refunded\",\"type\":\"charge.refunded\",\"data\":{\"object\":{\"id\":\"ch_12\",\"payment_intent\":\"pi_12\"}}}")
                .andExpect(status().isOk());
        assertEquals("REFUNDED",p.status);assertEquals(400,p.refundedAmount);
        verify(http,times(2)).send(any(HttpRequest.class),any());verify(mapper).recomputeTrips(1L);
    }
}
