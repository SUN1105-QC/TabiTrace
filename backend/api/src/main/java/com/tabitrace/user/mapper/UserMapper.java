package com.tabitrace.user.mapper;

import com.tabitrace.user.entity.UserEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id=#{id}") UserEntity findById(Long id);
    @Select("SELECT * FROM users WHERE email=#{email}") UserEntity findByEmail(String email);
    @Insert("""
        INSERT INTO users(email,password_hash,nickname,status,locale,timezone,default_visibility,email_notifications,created_at,updated_at)
        VALUES(#{email},#{passwordHash},#{nickname},'ACTIVE',#{locale},#{timezone},#{defaultVisibility},#{emailNotifications},UTC_TIMESTAMP(),UTC_TIMESTAMP())
        """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(UserEntity user);
    @Update("""
        UPDATE users SET nickname=#{nickname},bio=#{bio},locale=#{locale},timezone=#{timezone},distance_unit=#{distanceUnit},
        default_visibility=#{defaultVisibility},share_exact_location=#{shareExactLocation},share_link_expiry_days=#{shareLinkExpiryDays},
        email_notifications=#{emailNotifications},notify_trip_reminder=#{notifyTripReminder},notify_story=#{notifyStory},
        notify_achievement=#{notifyAchievement},notify_share=#{notifyShare},updated_at=UTC_TIMESTAMP() WHERE id=#{id}
        """) int updateProfile(UserEntity user);
    @Update("UPDATE users SET avatar_url=#{avatarUrl},updated_at=UTC_TIMESTAMP() WHERE id=#{id}")
    int updateAvatar(@Param("id") Long id, @Param("avatarUrl") String avatarUrl);
    @Update("UPDATE users SET password_hash=#{passwordHash},updated_at=UTC_TIMESTAMP() WHERE id=#{id}")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);
}
