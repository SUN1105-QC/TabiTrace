package com.tabitrace.achievement.mapper;

import com.tabitrace.achievement.entity.AchievementEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface AchievementMapper {
    @Select("SELECT * FROM achievements WHERE type='GLOBAL' OR city_code=#{cityCode} ORDER BY id") List<AchievementEntity> listForCity(String cityCode);
    @Select("SELECT achievement_id FROM user_achievements WHERE user_id=#{userId} AND trip_id=#{tripId}") List<Long> earnedIds(@Param("userId") Long userId,@Param("tripId") Long tripId);
    @Select("SELECT achievement_id AS achievementId, earned_at AS earnedAt FROM user_achievements WHERE user_id=#{userId} AND trip_id=#{tripId}") List<java.util.Map<String,Object>> earnedRows(@Param("userId") Long userId,@Param("tripId") Long tripId);
    @Insert("INSERT IGNORE INTO user_achievements(user_id,trip_id,achievement_id,earned_at) VALUES(#{userId},#{tripId},#{achievementId},UTC_TIMESTAMP())") int earn(@Param("userId") Long userId,@Param("tripId") Long tripId,@Param("achievementId") Long achievementId);
    @Select("SELECT COUNT(*) FROM user_achievements WHERE trip_id=#{tripId}") int countEarned(Long tripId);
}
