package com.tabitrace.user.mapper;

import com.tabitrace.user.entity.UserEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id=#{id}") UserEntity findById(Long id);
    @Select("SELECT * FROM users WHERE id=#{id} FOR UPDATE") UserEntity lockById(Long id);
    /** 买断终身 Pro：只记第一次付款的时间（重复回调不覆盖） */
    @Update("UPDATE users SET lifetime_pro_at=IFNULL(lifetime_pro_at,UTC_TIMESTAMP()),updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int grantLifetimePro(Long id);
    @Select("SELECT * FROM users WHERE email=#{email}") UserEntity findByEmail(String email);

    // ───────────── 注销账号（7 天冷静期） ─────────────
    @Update("UPDATE users SET status='DELETION_PENDING',deletion_requested_at=UTC_TIMESTAMP(6),deletion_scheduled_at=#{scheduledAt},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id} AND status='ACTIVE'")
    int requestDeletion(@Param("id") Long id, @Param("scheduledAt") java.time.LocalDateTime scheduledAt);
    @Update("UPDATE users SET status='ACTIVE',deletion_requested_at=NULL,deletion_scheduled_at=NULL,updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id} AND status='DELETION_PENDING' AND deletion_requested_by_admin=FALSE")
    int cancelDeletion(Long id);
    /** 冷静期已到的账号 */
    @Select("SELECT id FROM users WHERE status='DELETION_PENDING' AND deletion_scheduled_at<=UTC_TIMESTAMP() ORDER BY deletion_scheduled_at LIMIT #{limit}")
    java.util.List<Long> listDueForDeletion(int limit);
    /** 最终删除：只删仍在冷静期且已到期的账号（用户在此之前撤销则不删）；其余数据随外键级联删除 */
    @Delete("DELETE FROM users WHERE id=#{id} AND status='DELETION_PENDING' AND deletion_scheduled_at<=UTC_TIMESTAMP()")
    int deleteIfDue(Long id);
    @Select("SELECT id FROM users WHERE id=#{id} AND status='DELETION_PENDING' AND deletion_scheduled_at<=UTC_TIMESTAMP() FOR UPDATE")
    Long lockDueForDeletion(Long id);
    @Insert("""
        INSERT INTO users(email,password_hash,nickname,status,locale,timezone,default_visibility,email_notifications,user_level,trip_limit,trip_retention_months,can_share,can_video,custom_music_access,created_at,updated_at)
        VALUES(#{email},#{passwordHash},#{nickname},'ACTIVE',#{locale},#{timezone},#{defaultVisibility},#{emailNotifications},#{userLevel},#{tripLimit},#{tripRetentionMonths},#{canShare},#{canVideo},#{customMusicAccess},UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
        """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(UserEntity user);
    @Update("""
        UPDATE users SET nickname=#{nickname},bio=#{bio},locale=#{locale},timezone=#{timezone},distance_unit=#{distanceUnit},
        default_visibility=#{defaultVisibility},share_exact_location=#{shareExactLocation},share_link_expiry_days=#{shareLinkExpiryDays},
        email_notifications=#{emailNotifications},notify_trip_reminder=#{notifyTripReminder},notify_story=#{notifyStory},
        notify_achievement=#{notifyAchievement},notify_share=#{notifyShare},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}
        """) int updateProfile(UserEntity user);
    @Update("UPDATE users SET avatar_url=#{avatarUrl},avatar_small_url=#{avatarSmallUrl},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}")
    int updateAvatar(@Param("id") Long id, @Param("avatarUrl") String avatarUrl, @Param("avatarSmallUrl") String avatarSmallUrl);
    @Update("UPDATE users SET password_hash=#{passwordHash},updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);
}
