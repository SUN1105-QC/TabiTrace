package com.tabitrace.payment.mapper;

import com.tabitrace.payment.entity.PaymentEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PaymentMapper {
    @Insert("""
      INSERT INTO payments(user_id,trip_id,order_user_id,order_trip_id,checkout_key,product,provider,provider_payment_id,amount,currency,status,created_at,updated_at)
      VALUES(#{userId},#{tripId},#{orderUserId},#{orderTripId},#{checkoutKey},#{product},#{provider},#{providerPaymentId},#{amount},#{currency},#{status},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(PaymentEntity p);
    @Select("SELECT * FROM payments WHERE id=#{id}") PaymentEntity findById(Long id);
    @Select("SELECT * FROM payments WHERE id=#{id} FOR UPDATE") PaymentEntity lock(Long id);
    @Select("SELECT id FROM users WHERE id=#{userId} FOR UPDATE") Long lockUser(Long userId);
    @Select("SELECT COUNT(*) FROM users WHERE id=#{userId} AND lifetime_pro_at IS NOT NULL") int hasLifetime(Long userId);
    @Select("SELECT * FROM payments WHERE user_id=#{userId} AND status='PENDING' ORDER BY id LIMIT 1") PaymentEntity pendingByUser(Long userId);
    @Select("SELECT * FROM payments WHERE user_id=#{userId} ORDER BY id DESC LIMIT 100") java.util.List<PaymentEntity> history(Long userId);
    @Select("SELECT * FROM payments WHERE payment_intent_id=#{intentId}") PaymentEntity findByIntent(String intentId);
    @Select("SELECT * FROM payments WHERE trip_id=#{tripId} ORDER BY id DESC LIMIT 1") PaymentEntity latestByTrip(Long tripId);
    @Select("SELECT * FROM payments WHERE user_id=#{userId} AND product='LIFETIME' ORDER BY id DESC LIMIT 1") PaymentEntity latestLifetime(Long userId);
    @Select("SELECT * FROM payments WHERE provider_payment_id=#{providerPaymentId} LIMIT 1") PaymentEntity findByProviderId(String providerPaymentId);
    @Update("""
        UPDATE payments SET provider_payment_id=#{providerPaymentId},checkout_url=#{checkoutUrl},checkout_key=#{checkoutKey},checkout_attempts=#{checkoutAttempts},
        payment_intent_id=#{paymentIntentId},charge_id=#{chargeId},refunded_amount=#{refundedAmount},
        dispute_id=#{disputeId},dispute_status=#{disputeStatus},expires_at=#{expiresAt},last_synced_at=#{lastSyncedAt},last_checked_at=#{lastCheckedAt},
        status=#{status},paid_at=#{paidAt},updated_at=UTC_TIMESTAMP() WHERE id=#{id}
        """) int update(PaymentEntity p);
    @Insert("INSERT IGNORE INTO payment_events(event_id,payment_id,event_type,created_at) VALUES(#{eventId},#{paymentId},#{eventType},UTC_TIMESTAMP(6))")
    int recordEvent(@Param("eventId") String eventId,@Param("paymentId") Long paymentId,@Param("eventType") String eventType);
    @Select("SELECT COUNT(*) FROM payment_events WHERE event_id=#{eventId}") int eventHandled(String eventId);
    @Select("""
        SELECT id FROM payments WHERE provider='STRIPE' AND (provider_payment_id IS NOT NULL OR status='PENDING')
        AND (last_checked_at IS NULL OR last_checked_at < TIMESTAMPADD(SECOND,
        -(CASE WHEN status='PENDING' THEN #{intervalSeconds} ELSE #{settledSeconds} END),UTC_TIMESTAMP()))
        ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END,COALESCE(last_checked_at,created_at),id LIMIT #{limit}
        """) java.util.List<Long> reconcileIds(@Param("intervalSeconds") int intervalSeconds,@Param("settledSeconds") int settledSeconds,@Param("limit") int limit);
    @Update("UPDATE payments SET last_checked_at=UTC_TIMESTAMP(6) WHERE id=#{id}") int touched(Long id);
    @Update("UPDATE payments SET last_checked_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND (last_checked_at IS NULL OR last_checked_at<TIMESTAMPADD(SECOND,-10,UTC_TIMESTAMP()))") int claimRefresh(Long id);
    @Update("""
        UPDATE users u SET lifetime_pro_at=CASE WHEN u.lifetime_pro_grant THEN COALESCE(u.lifetime_pro_at,UTC_TIMESTAMP())
        ELSE (SELECT MIN(p.paid_at) FROM payments p WHERE p.user_id=u.id AND p.product='LIFETIME'
        AND p.status IN ('PAID','PARTIALLY_REFUNDED')) END,updated_at=UTC_TIMESTAMP() WHERE u.id=#{userId}
        """) int recomputeLifetime(Long userId);
    @Update("""
        UPDATE trips t JOIN users u ON u.id=t.user_id SET t.plan_type=CASE WHEN t.pro_grant OR u.lifetime_pro_at IS NOT NULL
        OR EXISTS(SELECT 1 FROM payments p WHERE p.trip_id=t.id AND p.product='TRIP_PRO' AND p.status IN ('PAID','PARTIALLY_REFUNDED'))
        THEN 'PRO' ELSE 'FREE' END,t.updated_at=UTC_TIMESTAMP() WHERE t.user_id=#{userId}
        """) int recomputeTrips(Long userId);
    @Update("""
        UPDATE memberships m JOIN payments p ON p.id=m.payment_id SET m.status=CASE
        WHEN p.status IN ('PAID','PARTIALLY_REFUNDED') THEN 'ACTIVE' ELSE 'REVOKED' END,m.updated_at=UTC_TIMESTAMP()
        WHERE p.user_id=#{userId} AND m.source='LIFETIME' AND p.product='LIFETIME'
        """) int syncMemberships(Long userId);
}
