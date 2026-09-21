package com.tabitrace.payment.mapper;

import com.tabitrace.payment.entity.PaymentEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PaymentMapper {
    @Insert("""
      INSERT INTO payments(user_id,trip_id,provider,provider_payment_id,amount,currency,status,created_at,updated_at)
      VALUES(#{userId},#{tripId},#{provider},#{providerPaymentId},#{amount},#{currency},#{status},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(PaymentEntity p);
    @Select("SELECT * FROM payments WHERE id=#{id}") PaymentEntity findById(Long id);
    @Select("SELECT * FROM payments WHERE trip_id=#{tripId} ORDER BY id DESC LIMIT 1") PaymentEntity latestByTrip(Long tripId);
    @Select("SELECT * FROM payments WHERE provider_payment_id=#{providerPaymentId} LIMIT 1") PaymentEntity findByProviderId(String providerPaymentId);
    @Update("UPDATE payments SET provider_payment_id=#{providerPaymentId},status=#{status},paid_at=#{paidAt},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int update(PaymentEntity p);
}
