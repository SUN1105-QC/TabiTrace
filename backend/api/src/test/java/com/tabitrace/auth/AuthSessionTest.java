package com.tabitrace.auth;

import com.tabitrace.auth.entity.RefreshTokenEntity;
import com.tabitrace.verification.service.EmailVerificationService;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.auth.service.UserAgentLabel;
import com.tabitrace.common.BusinessException;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthSessionTest {
    final JwtService jwt = new JwtService("0123456789012345678901234567890123456789", 15, 30);
    final RefreshTokenMapper tokens = mock(RefreshTokenMapper.class);
    final AuthService service = new AuthService(mock(UserMapper.class), tokens, mock(PasswordEncoder.class), jwt, mock(EmailVerificationService.class));

    @Test
    void accessTokenCarriesSessionIdOfItsRefreshToken() {
        JwtService.TokenWithJti refresh = jwt.createRefreshToken(7L, "a@example.test");
        String access = jwt.createAccessToken(7L, "a@example.test", refresh.jti());
        assertEquals(refresh.jti(), jwt.parse(access).get("sid", String.class));
        assertNull(jwt.parse(jwt.createAccessToken(7L, "a@example.test")).get("sid", String.class));
    }

    @Test
    void currentSessionFallsBackToOwnRefreshTokenOnly() {
        assertEquals("sid-1", service.currentSessionJti(7L, "sid-1", null));
        JwtService.TokenWithJti own = jwt.createRefreshToken(7L, "a@example.test");
        assertEquals(own.jti(), service.currentSessionJti(7L, null, own.token()));
        JwtService.TokenWithJti other = jwt.createRefreshToken(8L, "b@example.test");
        assertNull(service.currentSessionJti(7L, null, other.token()));
        assertNull(service.currentSessionJti(7L, null, jwt.createAccessToken(7L, "a@example.test")));
        assertNull(service.currentSessionJti(7L, null, "garbage"));
    }

    @Test
    void sessionsMarkCurrentDeviceAndCannotRevokeItHere() {
        RefreshTokenEntity cur = token(1L, "jti-cur", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36");
        RefreshTokenEntity phone = token(2L, "jti-phone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
        when(tokens.listActive(7L)).thenReturn(List.of(cur, phone));
        var list = service.sessions(7L, "jti-cur");
        assertTrue(list.get(0).current());
        assertEquals("Chrome · Windows", list.get(0).device());
        assertEquals("Safari · iPhone", list.get(1).device());
        assertTrue(list.get(1).mobile());

        assertThrows(BusinessException.class, () -> service.revokeSession(7L, 1L, "jti-cur"));
        assertThrows(BusinessException.class, () -> service.revokeSession(7L, 99L, "jti-cur"));
        service.revokeSession(7L, 2L, "jti-cur");
        verify(tokens).revokeById(7L, 2L);
    }

    @Test
    void revokeOthersNeedsToKnowCurrentDevice() {
        assertThrows(BusinessException.class, () -> service.revokeOtherSessions(7L, null));
        verify(tokens, never()).revokeOthers(any(), any());
        service.revokeOtherSessions(7L, "jti-cur");
        verify(tokens).revokeOthers(7L, "jti-cur");
    }

    @Test
    void userAgentLabels() {
        assertEquals("未知设备", UserAgentLabel.parse(null).label());
        assertEquals("Edge · Windows", UserAgentLabel.parse("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/140 Safari/537 Edg/140").label());
        assertEquals("其他客户端", UserAgentLabel.parse("node").label());
    }

    private static RefreshTokenEntity token(Long id, String jti, String ua) {
        RefreshTokenEntity t = new RefreshTokenEntity();
        t.id = id; t.jti = jti; t.userAgent = ua; t.createdAt = LocalDateTime.now(); t.expiresAt = LocalDateTime.now().plusDays(30);
        return t;
    }
}
