package com.tabitrace.trip.mapper;

import com.tabitrace.trip.entity.TripEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface TripMapper {
    @Insert("""
      INSERT INTO trips(user_id,title,destination_name,country_code,city,start_date,end_date,people_count,cover_image,plan_type,status,visibility,created_at,updated_at)
      VALUES(#{userId},#{title},#{destinationName},#{countryCode},#{city},#{startDate},#{endDate},#{peopleCount},#{coverImage},#{planType},#{status},#{visibility},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(TripEntity trip);
    @Select("SELECT * FROM trips WHERE id=#{id}") TripEntity findById(Long id);
    @Select("SELECT * FROM trips WHERE user_id=#{userId} ORDER BY start_date DESC,id DESC") List<TripEntity> findByUser(Long userId);
    @Select("SELECT COUNT(*) FROM trips WHERE user_id=#{userId} AND plan_type='FREE' AND status<>'ARCHIVED'") int countFreeTrips(Long userId);
    @Update("""
      UPDATE trips SET title=#{title},destination_name=#{destinationName},country_code=#{countryCode},city=#{city},start_date=#{startDate},end_date=#{endDate},people_count=#{peopleCount},cover_image=#{coverImage},updated_at=UTC_TIMESTAMP() WHERE id=#{id}
      """) int update(TripEntity trip);
    @Update("UPDATE trips SET status='COMPLETED',updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int complete(Long id);
    @Update("UPDATE trips SET status=#{status},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int updateStatus(@Param("id") Long id,@Param("status") String status);
    @Update("UPDATE trips SET plan_type=#{planType},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int updatePlan(@Param("id") Long id,@Param("planType") String planType);
    @Update("UPDATE trips SET visibility=#{visibility},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int updateVisibility(@Param("id") Long id,@Param("visibility") String visibility);
    @Delete("DELETE FROM trips WHERE id=#{id}") int delete(Long id);
    @Update("UPDATE trips SET cover_image=#{url},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int updateCover(@Param("id") Long id,@Param("url") String url);
    /** 旅行封面正好是被删除的照片时清空，避免封面指向已删除的照片 */
    @Update("UPDATE trips SET cover_image=NULL,updated_at=UTC_TIMESTAMP() WHERE id=#{id} AND cover_image=#{url}") int clearCoverIf(@Param("id") Long id,@Param("url") String url);
}
