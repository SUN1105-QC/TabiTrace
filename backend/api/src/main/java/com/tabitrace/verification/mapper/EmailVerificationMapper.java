package com.tabitrace.verification.mapper;

import com.tabitrace.verification.entity.EmailVerificationEntity;
import org.apache.ibatis.annotations.*;

@Mapper
public interface EmailVerificationMapper {
    @Insert("""
        INSERT INTO email_verifications(email,purpose,code_hash,max_attempts,send_status,expires_at,invalidated_at,requester_ip_hash,created_at)
        VALUES(#{e.email},#{e.purpose},#{e.codeHash},#{e.maxAttempts},'PENDING',DATE_ADD(UTC_TIMESTAMP(6), INTERVAL #{ttlSeconds} SECOND),
               #{e.invalidatedAt},#{e.requesterIpHash},UTC_TIMESTAMP(6))
        """)
    @Options(useGeneratedKeys = true, keyProperty = "e.id")
    int insert(@Param("e") EmailVerificationEntity e, @Param("ttlSeconds") long ttlSeconds);

    @Update("UPDATE email_verifications SET send_status='SENT' WHERE id=#{id}")
    int markSent(Long id);

    /** 发送失败：记录作废，不会被当成“验证码已发送” */
    @Update("UPDATE email_verifications SET send_status='FAILED', invalidated_at=COALESCE(invalidated_at, UTC_TIMESTAMP(6)) WHERE id=#{id}")
    int markFailed(Long id);

    /** 新验证码发出后，同一邮箱同一用途更早的验证码（含已验证但尚未使用的令牌）全部失效；只作废比自己旧的，并发时最新的一条胜出 */
    @Update("""
        UPDATE email_verifications SET invalidated_at=UTC_TIMESTAMP(6)
        WHERE email=#{email} AND purpose=#{purpose} AND id<#{keepId} AND invalidated_at IS NULL AND consumed_at IS NULL
        """)
    int invalidateOthers(@Param("email") String email, @Param("purpose") String purpose, @Param("keepId") Long keepId);

    /** 距离最近一次（未失败的）发送过去了多少秒；没有发送记录时为 null */
    @Select("""
        SELECT TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP(6)) FROM email_verifications
        WHERE email=#{email} AND purpose=#{purpose} AND send_status IN ('PENDING','SENT') ORDER BY id DESC LIMIT 1
        """)
    Long secondsSinceLastSend(@Param("email") String email, @Param("purpose") String purpose);

    /**
     * 插入之后再确认冷却：冷却窗口内是否已有比自己更早、未失败的发送。插入是立即提交的，
     * 所以两个并发请求里较晚的一方一定能看到较早的一方，只有一个能继续发邮件。
     */
    @Select("""
        SELECT COUNT(*) FROM email_verifications
        WHERE email=#{email} AND purpose=#{purpose} AND id<#{id} AND send_status IN ('PENDING','SENT')
          AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)
        """)
    int countEarlierSendsWithin(@Param("email") String email, @Param("purpose") String purpose, @Param("id") Long id, @Param("windowSeconds") long windowSeconds);

    /** 被冷却拦下的重复请求：作废且不计入冷却，但仍计入每小时次数 */
    @Update("UPDATE email_verifications SET send_status='THROTTLED', invalidated_at=UTC_TIMESTAMP(6) WHERE id=#{id}")
    int markThrottled(Long id);

    @Select("SELECT COUNT(*) FROM email_verifications WHERE email=#{email} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    int countByEmailSince(@Param("email") String email, @Param("windowSeconds") long windowSeconds);

    @Select("SELECT COUNT(*) FROM email_verifications WHERE requester_ip_hash=#{ipHash} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    int countByIpSince(@Param("ipHash") String ipHash, @Param("windowSeconds") long windowSeconds);

    /** 窗口内最早一条记录还要多久滑出窗口（秒），用于告诉用户何时可以再试 */
    @Select("SELECT GREATEST(1, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), DATE_ADD(MIN(created_at), INTERVAL #{windowSeconds} SECOND))) FROM email_verifications WHERE email=#{email} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    Long emailWindowResetSeconds(@Param("email") String email, @Param("windowSeconds") long windowSeconds);

    @Select("SELECT GREATEST(1, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), DATE_ADD(MIN(created_at), INTERVAL #{windowSeconds} SECOND))) FROM email_verifications WHERE requester_ip_hash=#{ipHash} AND created_at > DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{windowSeconds} SECOND)")
    Long ipWindowResetSeconds(@Param("ipHash") String ipHash, @Param("windowSeconds") long windowSeconds);

    /** 当前可验证的那一条验证码（最新、已发送、未失效 / 未验证 / 未使用），加行锁防止并发猜码绕过次数限制 */
    @Select("""
        SELECT *, (expires_at <= UTC_TIMESTAMP(6)) AS expired FROM email_verifications
        WHERE email=#{email} AND purpose=#{purpose} AND send_status='SENT'
          AND invalidated_at IS NULL AND verified_at IS NULL AND consumed_at IS NULL
        ORDER BY id DESC LIMIT 1 FOR UPDATE
        """)
    EmailVerificationEntity lockPending(@Param("email") String email, @Param("purpose") String purpose);

    @Update("UPDATE email_verifications SET attempts=attempts+1 WHERE id=#{id}")
    int incrementAttempts(Long id);

    @Update("""
        UPDATE email_verifications SET verified_at=UTC_TIMESTAMP(6), token_hash=#{tokenHash},
               token_expires_at=DATE_ADD(UTC_TIMESTAMP(6), INTERVAL #{tokenTtlSeconds} SECOND)
        WHERE id=#{id} AND verified_at IS NULL
        """)
    int markVerified(@Param("id") Long id, @Param("tokenHash") String tokenHash, @Param("tokenTtlSeconds") long tokenTtlSeconds);

    @Select("SELECT *, (token_expires_at <= UTC_TIMESTAMP(6)) AS token_expired FROM email_verifications WHERE token_hash=#{tokenHash} FOR UPDATE")
    EmailVerificationEntity lockByToken(String tokenHash);

    /** 一次性消费：只有第一次成功（行锁 + consumed_at IS NULL 条件双重保证） */
    @Update("UPDATE email_verifications SET consumed_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND consumed_at IS NULL")
    int consume(Long id);

    /** 定期清理：保留 7 天，足够覆盖所有频率限制窗口与问题排查 */
    @Delete("DELETE FROM email_verifications WHERE created_at < DATE_SUB(UTC_TIMESTAMP(6), INTERVAL #{days} DAY)")
    int deleteOlderThan(int days);
}
