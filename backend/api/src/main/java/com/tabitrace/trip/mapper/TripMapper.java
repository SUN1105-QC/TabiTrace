package com.tabitrace.trip.mapper;

import com.tabitrace.trip.entity.TripEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface TripMapper {
    @Insert("""
      INSERT INTO trips(user_id,title,destination_name,country_code,city,start_date,end_date,people_count,cover_image,plan_type,status,visibility,created_at,expires_at,updated_at)
      VALUES(#{userId},#{title},#{destinationName},#{countryCode},#{city},#{startDate},#{endDate},#{peopleCount},#{coverImage},#{planType},#{status},#{visibility},#{createdAt},#{expiresAt},UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(TripEntity trip);
    @Select("SELECT * FROM trips WHERE id=#{id}") TripEntity findById(Long id);
    @Select("SELECT user_id FROM trips WHERE id=#{id} FOR UPDATE") Long lockOwner(Long id);
    @Select("SELECT * FROM trips WHERE user_id=#{userId} AND expires_at>UTC_TIMESTAMP(6) ORDER BY start_date DESC,id DESC") List<TripEntity> findByUser(Long userId);
    /** Lock the account before counting: concurrent creation cannot exceed the account quota. */
    @Select("SELECT * FROM users WHERE id=#{id} FOR UPDATE") com.tabitrace.user.entity.UserEntity lockPolicy(Long id);
    @Select("SELECT COUNT(*) FROM trips WHERE user_id=#{userId} AND expires_at>UTC_TIMESTAMP(6)") int countLiveTrips(Long userId);
    @Select("SELECT * FROM trips WHERE expires_at<=UTC_TIMESTAMP(6) ORDER BY expires_at,id LIMIT #{limit}") List<TripEntity> expired(int limit);
    /** Remove private place details owned exclusively by the expiring journey; never touch official/shared places. */
    @Delete("""
      DELETE p FROM places p WHERE p.source_type='CUSTOM'
        AND (EXISTS(SELECT 1 FROM trip_places x WHERE x.trip_id=#{tripId} AND x.place_id=p.id)
          OR EXISTS(SELECT 1 FROM checkins x WHERE x.trip_id=#{tripId} AND x.place_id=p.id)
          OR EXISTS(SELECT 1 FROM itinerary_items x WHERE x.trip_id=#{tripId} AND x.place_id=p.id))
        AND NOT EXISTS(SELECT 1 FROM trip_places x WHERE x.trip_id<>#{tripId} AND x.place_id=p.id)
        AND NOT EXISTS(SELECT 1 FROM checkins x WHERE x.trip_id<>#{tripId} AND x.place_id=p.id)
        AND NOT EXISTS(SELECT 1 FROM itinerary_items x WHERE x.trip_id<>#{tripId} AND x.place_id=p.id)
      """) int deleteExclusiveCustomPlaces(Long tripId);
    @Update("UPDATE trips SET expires_at=DATE_ADD(created_at,INTERVAL #{months} MONTH),updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE user_id=#{userId} AND expires_at>UTC_TIMESTAMP(6)")
    int updateRetention(@Param("userId") Long userId,@Param("months") int months);
    @Select("SELECT COUNT(*) FROM trips WHERE user_id=#{userId} AND plan_type='FREE' AND status<>'ARCHIVED'") int countFreeTrips(Long userId);
    @Update("""
      UPDATE trips SET title=#{title},destination_name=#{destinationName},country_code=#{countryCode},city=#{city},start_date=#{startDate},end_date=#{endDate},people_count=#{peopleCount},cover_image=#{coverImage},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}
      """) int update(TripEntity trip);
    @Update("UPDATE trips SET status='COMPLETED',updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int complete(Long id);
    @Update("UPDATE trips SET status=#{status},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int updateStatus(@Param("id") Long id,@Param("status") String status);
    /** 全部功能免费开放：一次性把所有 FREE 旅行升级为 PRO（启动时执行，重复执行无影响） */
    @Update("UPDATE trips SET plan_type='PRO',updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE plan_type='FREE'") int upgradeAllFreeToPro();
    @Update("UPDATE trips SET plan_type=#{planType},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int updatePlan(@Param("id") Long id,@Param("planType") String planType);
    /** 终身 Pro：账号下所有旅行升级为 PRO（含已归档的） */
    @Update("UPDATE trips SET plan_type='PRO',updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE user_id=#{userId} AND plan_type<>'PRO'") int upgradeAllOfUser(Long userId);
    /** 账号是否已买断终身 Pro（新建旅行直接是 PRO） */
    @Select("SELECT COUNT(*) FROM users WHERE id=#{userId} AND lifetime_pro_at IS NOT NULL") int hasLifetimePro(Long userId);
    @Update("UPDATE trips SET visibility=#{visibility},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int updateVisibility(@Param("id") Long id,@Param("visibility") String visibility);
    @Delete("DELETE FROM trips WHERE id=#{id}") int delete(Long id);
    @Update("UPDATE trips SET cover_image=#{url},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int updateCover(@Param("id") Long id,@Param("url") String url);
    /** 旅行封面正好是被删除的照片时清空，避免封面指向已删除的照片 */
    @Update("UPDATE trips SET cover_image=NULL,updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id} AND cover_image=#{url}") int clearCoverIf(@Param("id") Long id,@Param("url") String url);
}
