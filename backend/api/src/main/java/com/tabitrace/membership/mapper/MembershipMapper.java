package com.tabitrace.membership.mapper;

import com.tabitrace.membership.entity.MembershipEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface MembershipMapper {
    @Select("SELECT * FROM memberships WHERE user_id=#{userId} ORDER BY id DESC") List<MembershipEntity> listByUser(Long userId);
    @Select("SELECT COUNT(*) FROM memberships WHERE user_id=#{userId} AND source='LIFETIME' AND status='ACTIVE'") int countActiveLifetime(Long userId);
    @Insert("""
      INSERT INTO memberships(user_id,plan,source,status,started_at,expires_at,payment_id,created_at,updated_at)
      VALUES(#{userId},#{plan},#{source},#{status},#{startedAt},#{expiresAt},#{paymentId},UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(MembershipEntity m);
}
