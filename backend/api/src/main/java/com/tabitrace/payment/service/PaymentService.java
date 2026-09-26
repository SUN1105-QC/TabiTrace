package com.tabitrace.payment.service;

import tools.jackson.databind.JsonNode;
import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.dto.PaymentDtos.*;
import com.tabitrace.payment.entity.PaymentEntity;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
public class PaymentService {
    /** Trip Pro 单次旅行价格：人民币 128 元，按最小货币单位（分）存储与提交给 Stripe */
    public static final int TRIP_PRO_AMOUNT=12800;
    public static final String TRIP_PRO_CURRENCY="CNY";
    private final PaymentMapper mapper;private final TripService trips;private final TripMapper tripMapper;private final StripeGateway stripe;private final String mode;private final String publicUrl;
    public PaymentService(PaymentMapper mapper,TripService trips,TripMapper tripMapper,StripeGateway stripe,@Value("${app.payments.mode:mock}") String mode,@Value("${app.public-url:http://localhost:3000}") String publicUrl){this.mapper=mapper;this.trips=trips;this.tripMapper=tripMapper;this.stripe=stripe;this.mode=mode;this.publicUrl=publicUrl.replaceAll("/$","");}
    /** 当前支付方式：stripe 为真实付款；其他值为本地模拟支付（不会产生真实扣款） */
    public boolean realPayments(){return "stripe".equalsIgnoreCase(mode);}
    @Transactional public CheckoutResponse checkout(Long userId,Long tripId){TripEntity t=trips.requireOwned(userId,tripId);if("PRO".equals(t.planType))throw new BusinessException("TRIP_ALREADY_PRO","当前旅行已经是 Pro");PaymentEntity p=new PaymentEntity();p.userId=userId;p.tripId=tripId;p.amount=TRIP_PRO_AMOUNT;p.currency=TRIP_PRO_CURRENCY;p.provider="stripe".equalsIgnoreCase(mode)?"STRIPE":"MOCK";p.status="PENDING";mapper.insert(p);if(!"stripe".equalsIgnoreCase(mode)){p.providerPaymentId="mock_"+p.id;p.status="PAID";p.paidAt=LocalDateTime.now(java.time.ZoneOffset.UTC);mapper.update(p);tripMapper.updatePlan(tripId,"PRO");return new CheckoutResponse(p.id,p.status,publicUrl+"/trips/"+tripId+"?mockPayment=success",true);}var session=stripe.createCheckout(p.id,tripId,p.amount,p.currency,publicUrl+"/pricing?trip="+tripId+"&payment=success",publicUrl+"/pricing?trip="+tripId+"&payment=cancelled");p.providerPaymentId=session.id();mapper.update(p);return new CheckoutResponse(p.id,p.status,session.url(),false);}
    public PaymentView latest(Long userId,Long tripId){trips.requireOwned(userId,tripId);PaymentEntity p=mapper.latestByTrip(tripId);return p==null?null:view(p);}
    @Transactional public void webhook(String payload,String signature){JsonNode event=stripe.verifyWebhook(payload,signature);String type=event.path("type").asText();if(!"checkout.session.completed".equals(type)&&!"checkout.session.async_payment_succeeded".equals(type))return;JsonNode obj=event.path("data").path("object");if("checkout.session.completed".equals(type)&&!"paid".equalsIgnoreCase(obj.path("payment_status").asText()))return;String paymentIdText=obj.path("metadata").path("payment_id").asText();PaymentEntity p=null;if(!paymentIdText.isBlank())try{p=mapper.findById(Long.valueOf(paymentIdText));}catch(NumberFormatException ignored){}if(p==null)p=mapper.findByProviderId(obj.path("id").asText());if(p==null)return;if("PAID".equals(p.status))return;p.providerPaymentId=obj.path("id").asText();p.status="PAID";p.paidAt=LocalDateTime.now(java.time.ZoneOffset.UTC);mapper.update(p);tripMapper.updatePlan(p.tripId,"PRO");}
    private static PaymentView view(PaymentEntity p){return new PaymentView(p.id,p.tripId,p.provider,p.providerPaymentId,p.amount,p.currency,p.status,p.paidAt,p.createdAt);}
}
