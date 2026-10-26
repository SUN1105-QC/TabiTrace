package com.tabitrace.membership;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.entity.MembershipEntity;
import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 账号会员：从未开通 / 有效（永久或未到期）/ 已到期（含被撤销），以及会员专属功能的统一 403 */
class MembershipServiceTest {
    static final LocalDateTime NOW = LocalDateTime.now(ZoneOffset.UTC);

    static MembershipEntity row(String source, String status, LocalDateTime expiresAt) {
        MembershipEntity m = new MembershipEntity();
        m.userId = 1L; m.source = source; m.status = status; m.startedAt = NOW.minusDays(30); m.expiresAt = expiresAt; m.updatedAt = NOW.minusDays(1);
        return m;
    }

    MembershipService service(MembershipEntity... rows) {
        MembershipMapper mapper = mock(MembershipMapper.class);
        when(mapper.listByUser(1L)).thenReturn(List.of(rows));
        return new MembershipService(mapper);
    }

    @Test void noMembership() {
        var m = service().current(1L);
        assertEquals("NONE", m.status());
        assertFalse(m.active());
        assertTrue(m.features().isEmpty());
    }

    @Test void lifetimeIsActiveForever() {
        var m = service(row("LIFETIME", "ACTIVE", null)).current(1L);
        assertEquals("ACTIVE", m.status());
        assertTrue(m.lifetime());
        assertEquals(List.of("CUSTOM_MUSIC"), m.features());
    }

    @Test void subscriptionActiveUntilExpiry() {
        assertEquals("ACTIVE", service(row("SUBSCRIPTION", "ACTIVE", NOW.plusDays(3))).current(1L).status());
        var expired = service(row("SUBSCRIPTION", "ACTIVE", NOW.minusMinutes(1))).current(1L);
        assertEquals("EXPIRED", expired.status());
        assertFalse(expired.active());
    }

    @Test void revokedCountsAsExpired() {
        assertEquals("EXPIRED", service(row("LIFETIME", "REVOKED", null)).current(1L).status());
    }

    @Test void anyActivePeriodWins() {
        var m = service(row("SUBSCRIPTION", "ACTIVE", NOW.minusDays(40)), row("SUBSCRIPTION", "ACTIVE", NOW.plusDays(20))).current(1L);
        assertEquals("ACTIVE", m.status());
        assertEquals(NOW.plusDays(20), m.expiresAt());
    }

    @Test void requireThrows403WithFeatureCode() {
        BusinessException none = assertThrows(BusinessException.class, () -> service().require(1L, MembershipService.FEATURE_CUSTOM_MUSIC));
        assertEquals("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", none.getCode());
        assertEquals(HttpStatus.FORBIDDEN, none.getStatus());
        assertEquals("上传自己的音乐是会员专属功能。", none.getMessage());
        assertEquals("NONE", none.getDetails().get("membership"));

        BusinessException expired = assertThrows(BusinessException.class,
                () -> service(row("SUBSCRIPTION", "ACTIVE", NOW.minusDays(1))).require(1L, MembershipService.FEATURE_CUSTOM_MUSIC));
        assertEquals("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", expired.getCode());
        assertEquals("会员已到期，续费后可继续使用自定义音乐。", expired.getMessage());
        assertEquals("EXPIRED", expired.getDetails().get("membership"));

        assertDoesNotThrow(() -> service(row("LIFETIME", "ACTIVE", null)).require(1L, MembershipService.FEATURE_CUSTOM_MUSIC));
    }

    @Test void grantLifetimeIsIdempotent() {
        MembershipMapper mapper = mock(MembershipMapper.class);
        when(mapper.countActiveLifetime(5L)).thenReturn(0, 1);
        MembershipService s = new MembershipService(mapper);
        s.grantLifetime(5L, 99L);
        s.grantLifetime(5L, 100L);
        verify(mapper, times(1)).insert(any());
    }
}
