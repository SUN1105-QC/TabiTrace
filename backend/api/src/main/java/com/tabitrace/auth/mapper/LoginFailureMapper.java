package com.tabitrace.auth.mapper;

import org.apache.ibatis.annotations.*;

@Mapper
public interface LoginFailureMapper {
    @Insert("INSERT INTO login_failures(email, ip_hash, created_at) VALUES(#{email}, #{ipHash}, UTC_TIMESTAMP(6))")
    int insert(@Param("email") String email, @Param("ipHash") String ipHash);

    @Select("SELECT COUNT(*) FROM login_failures WHERE email=#{email} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    int countByEmailSince(@Param("email") String email, @Param("windowSeconds") long windowSeconds);

    @Select("SELECT COUNT(*) FROM login_failures WHERE ip_hash=#{ipHash} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    int countByIpSince(@Param("ipHash") String ipHash, @Param("windowSeconds") long windowSeconds);

    /** 窗口内最早一次失败还要多久滑出窗口（秒） */
    @Select("SELECT GREATEST(1, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), DATE_ADD(MIN(created_at), INTERVAL #{windowSeconds} SECOND))) FROM login_failures WHERE email=#{email} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    Long emailWindowResetSeconds(@Param("email") String email, @Param("windowSeconds") long windowSeconds);

    @Select("SELECT GREATEST(1, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), DATE_ADD(MIN(created_at), INTERVAL #{windowSeconds} SECOND))) FROM login_failures WHERE ip_hash=#{ipHash} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    Long ipWindowResetSeconds(@Param("ipHash") String ipHash, @Param("windowSeconds") long windowSeconds);

    @Delete("DELETE FROM login_failures WHERE email=#{email}")
    int clear(String email);

    @Delete("DELETE FROM login_failures WHERE created_at < DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY)")
    int deleteExpired();
}
