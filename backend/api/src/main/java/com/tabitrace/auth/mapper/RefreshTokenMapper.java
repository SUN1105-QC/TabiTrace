package com.tabitrace.auth.mapper;

import com.tabitrace.auth.entity.RefreshTokenEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface RefreshTokenMapper {
    @Insert("INSERT INTO refresh_tokens(user_id,jti,expires_at,created_at) VALUES(#{userId},#{jti},#{expiresAt},UTC_TIMESTAMP())")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(RefreshTokenEntity token);
    @Select("SELECT * FROM refresh_tokens WHERE jti=#{jti} AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()") RefreshTokenEntity findActive(String jti);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE jti=#{jti} AND revoked_at IS NULL") int revoke(String jti);
    @Update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=#{userId} AND revoked_at IS NULL") int revokeAll(Long userId);
}
