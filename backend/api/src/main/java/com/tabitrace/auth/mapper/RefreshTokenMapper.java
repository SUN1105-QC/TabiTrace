package com.tabitrace.auth.mapper;

import com.tabitrace.auth.entity.RefreshTokenEntity;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface RefreshTokenMapper {
    @Insert("INSERT INTO refresh_tokens(user_id,jti,session_id,user_agent,session_started_at,expires_at,created_at) VALUES(#{userId},#{jti},#{sessionId},#{userAgent},#{sessionStartedAt},#{expiresAt},UTC_TIMESTAMP())")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(RefreshTokenEntity token);
    @Select("SELECT * FROM refresh_tokens WHERE jti=#{jti} AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()") RefreshTokenEntity findActive(String jti);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE jti=#{jti} AND revoked_at IS NULL") int revoke(String jti);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=#{userId} AND revoked_at IS NULL") int revokeAll(Long userId);

    /** 访问令牌所属的登录会话是否仍有效：同一会话刷新后旧 refresh token 已撤销，但新的那条仍有效 */
    @Select("SELECT EXISTS(SELECT 1 FROM refresh_tokens WHERE session_id=#{session} AND user_id=#{userId} AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP())")
    boolean isSessionActive(@Param("session") String session, @Param("userId") Long userId);

    /** 清理任务：过期或撤销超过 keepDays 天的记录（设备管理只显示有效会话，这些行不再有用） */
    @Delete("DELETE FROM refresh_tokens WHERE (expires_at<UTC_TIMESTAMP()-INTERVAL #{keepDays} DAY) OR (revoked_at IS NOT NULL AND revoked_at<UTC_TIMESTAMP()-INTERVAL #{keepDays} DAY) LIMIT #{limit}")
    int deleteStale(@Param("keepDays") int keepDays, @Param("limit") int limit);

    /** 登录会话：每个有效 refresh token 对应一台设备（刷新时旧 token 会被撤销） */
    @Select("SELECT * FROM refresh_tokens WHERE user_id=#{userId} AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY created_at DESC, id DESC")
    List<RefreshTokenEntity> listActive(Long userId);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE id=#{id} AND user_id=#{userId} AND revoked_at IS NULL")
    int revokeById(@Param("userId") Long userId, @Param("id") Long id);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=#{userId} AND jti<>#{keepJti} AND revoked_at IS NULL")
    int revokeOthers(@Param("userId") Long userId, @Param("keepJti") String keepJti);
}
