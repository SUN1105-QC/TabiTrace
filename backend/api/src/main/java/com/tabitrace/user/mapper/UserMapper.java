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
        UPDATE users SET nickname=#{nickname},avatar_url=#{avatarUrl},locale=#{locale},timezone=#{timezone},
        default_visibility=#{defaultVisibility},email_notifications=#{emailNotifications},updated_at=UTC_TIMESTAMP() WHERE id=#{id}
        """) int updateProfile(UserEntity user);
}
