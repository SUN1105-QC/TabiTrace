package com.tabitrace.membership.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.entity.MembershipEntity;
import com.tabitrace.membership.mapper.MembershipMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 账号会员：所有会员判断都走这里（前端只用来展示，后端每次都重新判断）。
 * 与 Trip Pro 是两种权益：Trip Pro 针对某一趟旅行，会员针对账号。
 * 状态：NONE（从未开通）/ ACTIVE（有效）/ EXPIRED（开通过，但已经到期或被撤销）。
 */
@Service
public class MembershipService {
    public static final String NONE = "NONE", ACTIVE = "ACTIVE", EXPIRED = "EXPIRED";
    /** 会员权益：上传 / 保存 / 跨旅行复用自定义音乐 */
    public static final String FEATURE_CUSTOM_MUSIC = "CUSTOM_MUSIC";
    public static final List<String> MEMBER_FEATURES = List.of(FEATURE_CUSTOM_MUSIC);

    /** status：NONE / ACTIVE / EXPIRED；source：LIFETIME / SUBSCRIPTION / GRANT；expiresAt 为空且 ACTIVE 表示永久 */
    public record MembershipView(String status, String source, LocalDateTime startedAt, LocalDateTime expiresAt, boolean lifetime, List<String> features) {
        public boolean active() { return ACTIVE.equals(status); }
    }

    private final MembershipMapper mapper;
    public MembershipService(MembershipMapper mapper) { this.mapper = mapper; }

    public MembershipView current(Long userId) {
        List<MembershipEntity> rows = mapper.listByUser(userId);
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        // 有多段有效会员时取结束最晚的（永久优先）
        MembershipEntity active = rows.stream().filter(m -> ACTIVE.equals(m.status) && (m.expiresAt == null || m.expiresAt.isAfter(now)))
                .max(Comparator.comparing((MembershipEntity m) -> m.expiresAt == null ? LocalDateTime.MAX : m.expiresAt)).orElse(null);
        if (active != null) return view(ACTIVE, active);
        if (rows.isEmpty()) return new MembershipView(NONE, null, null, null, false, List.of());
        // 已到期：展示最近结束的一段
        MembershipEntity last = rows.stream().max(Comparator.comparing((MembershipEntity m) -> m.expiresAt == null ? m.updatedAt : m.expiresAt,
                Comparator.nullsFirst(Comparator.naturalOrder()))).orElse(rows.get(0));
        return view(EXPIRED, last);
    }

    public boolean isActive(Long userId) { return current(userId).active(); }

    /**
     * 会员专属功能的统一检查：不是有效会员时返回 403。
     * 错误码按功能区分（自定义音乐：CUSTOM_MUSIC_REQUIRES_MEMBERSHIP），details.membership 说明是从未开通还是已到期。
     */
    public MembershipView require(Long userId, String feature) {
        MembershipView m = current(userId);
        if (m.active()) return m;
        String code = FEATURE_CUSTOM_MUSIC.equals(feature) ? "CUSTOM_MUSIC_REQUIRES_MEMBERSHIP" : "MEMBERSHIP_REQUIRED";
        String message = EXPIRED.equals(m.status())
                ? "会员已到期，续费后可继续使用自定义音乐。"
                : "上传自己的音乐是会员专属功能。";
        throw new BusinessException(code, message, HttpStatus.FORBIDDEN, Map.of("membership", m.status(), "feature", feature));
    }

    /** 买断终身 Pro 付款成功：写入一条永久会员记录（重复回调不会重复写入） */
    public void grantLifetime(Long userId, Long paymentId) {
        if (mapper.countActiveLifetime(userId) > 0) return;
        MembershipEntity m = new MembershipEntity();
        m.userId = userId; m.plan = "MEMBER"; m.source = "LIFETIME"; m.status = ACTIVE;
        m.startedAt = LocalDateTime.now(ZoneOffset.UTC); m.expiresAt = null; m.paymentId = paymentId;
        mapper.insert(m);
    }

    private static MembershipView view(String status, MembershipEntity m) {
        return new MembershipView(status, m.source, m.startedAt, m.expiresAt, ACTIVE.equals(status) && m.expiresAt == null,
                ACTIVE.equals(status) ? MEMBER_FEATURES : List.of());
    }
}
