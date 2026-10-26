package com.tabitrace.auth;

import com.tabitrace.auth.dto.AuthDtos.LoginRequest;
import com.tabitrace.auth.dto.AuthDtos.PasswordResetRequest;
import com.tabitrace.auth.mapper.LoginFailureMapper;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.auth.service.LoginThrottleService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.verification.VerificationPurpose;
import com.tabitrace.verification.service.EmailVerificationService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthLoginAndResetTest {
    final JwtService jwt = new JwtService("0123456789012345678901234567890123456789", 15, 30);
    final UserMapper users = mock(UserMapper.class);
    final RefreshTokenMapper tokens = mock(RefreshTokenMapper.class);
    final PasswordEncoder encoder = mock(PasswordEncoder.class);
    final EmailVerificationService verifications = mock(EmailVerificationService.class);
    final LoginThrottleService throttle = mock(LoginThrottleService.class);
    final AuthService service;

    AuthLoginAndResetTest() {
        when(encoder.encode("tabitrace-login-timing-equalizer")).thenReturn("$dummy");
        service = new AuthService(users, tokens, encoder, jwt, verifications, throttle);
    }

    private UserEntity user(String status) {
        UserEntity u = new UserEntity();
        u.id = 5L; u.email = "a@example.com"; u.passwordHash = "$real"; u.status = status;
        when(users.findByEmail("a@example.com")).thenReturn(u);
        when(users.findById(5L)).thenReturn(u);
        return u;
    }

    // ------------------------------------------------------------ 登录

    @Test
    void wrongPasswordAndUnknownEmailLookTheSameAndAreCounted() {
        user("ACTIVE");
        when(encoder.matches("bad", "$real")).thenReturn(false);
        BusinessException wrong = assertThrows(BusinessException.class, () -> service.login(new LoginRequest("A@example.com ", "bad"), null, "1.1.1.1"));
        BusinessException unknown = assertThrows(BusinessException.class, () -> service.login(new LoginRequest("nobody@example.com", "bad"), null, "1.1.1.1"));
        assertEquals("INVALID_CREDENTIALS", wrong.getCode());
        assertEquals(wrong.getCode(), unknown.getCode());
        assertEquals(wrong.getMessage(), unknown.getMessage());
        verify(throttle).recordFailure("a@example.com", "1.1.1.1");
        verify(throttle).recordFailure("nobody@example.com", "1.1.1.1");
        // 不存在的邮箱也跑一次 BCrypt，响应时间不泄露账号是否存在
        verify(encoder).matches("bad", "$dummy");
    }

    @Test
    void throttleIsCheckedBeforeThePassword() {
        doThrow(new BusinessException("TOO_MANY_ATTEMPTS", "尝试次数过多，请稍后再试", HttpStatus.TOO_MANY_REQUESTS))
            .when(throttle).check("a@example.com", "1.1.1.1");
        BusinessException ex = assertThrows(BusinessException.class, () -> service.login(new LoginRequest("a@example.com", "whatever"), null, "1.1.1.1"));
        assertEquals("TOO_MANY_ATTEMPTS", ex.getCode());
        verifyNoInteractions(users);
        verify(encoder, never()).matches(any(), any());
    }

    @Test
    void successfulLoginClearsFailures() {
        user("ACTIVE");
        when(encoder.matches("right", "$real")).thenReturn(true);
        assertNotNull(service.login(new LoginRequest("a@example.com", "right"), "UA", "1.1.1.1").accessToken());
        verify(throttle).clear("a@example.com");
        verify(throttle, never()).recordFailure(any(), any());
    }

    // ------------------------------------------------------------ 忘记密码

    @Test
    void resetPasswordConsumesTheResetTokenUpdatesPasswordAndSignsOutOtherDevices() {
        user("ACTIVE");
        when(encoder.encode("new-password-1")).thenReturn("$new");
        var res = service.resetPassword(new PasswordResetRequest(" A@example.com ", "new-password-1", "tok"), "UA");
        assertNotNull(res.accessToken());
        InOrder order = inOrder(verifications, users, tokens);
        order.verify(verifications).consume("tok", "a@example.com", VerificationPurpose.RESET_PASSWORD);
        order.verify(users).updatePassword(5L, "$new");
        order.verify(tokens).revokeAll(5L);
        verify(throttle).clear("a@example.com");
    }

    @Test
    void resetPasswordRejectsBadTokensAndUnavailableAccounts() {
        doThrow(new BusinessException("EMAIL_TOKEN_INVALID", "x")).when(verifications).consume(eq("fake"), any(), any());
        assertEquals("EMAIL_TOKEN_INVALID", assertThrows(BusinessException.class,
            () -> service.resetPassword(new PasswordResetRequest("a@example.com", "new-password-1", "fake"), null)).getCode());

        user("DISABLED");
        assertEquals("EMAIL_TOKEN_INVALID", assertThrows(BusinessException.class,
            () -> service.resetPassword(new PasswordResetRequest("a@example.com", "new-password-1", "tok"), null)).getCode());
        verify(users, never()).updatePassword(any(), any());
    }

    // ------------------------------------------------------------ 频率限制本身

    @Test
    void throttleLimitsByEmailAndIp() {
        LoginFailureMapper mapper = mock(LoginFailureMapper.class);
        LoginThrottleService t = new LoginThrottleService(mapper, "0123456789012345678901234567890123456789", 900, 8, 40);
        when(mapper.countByEmailSince("a@example.com", 900)).thenReturn(8);
        when(mapper.emailWindowResetSeconds("a@example.com", 900)).thenReturn(300L);
        BusinessException byEmail = assertThrows(BusinessException.class, () -> t.check("a@example.com", "1.1.1.1"));
        assertEquals("TOO_MANY_ATTEMPTS", byEmail.getCode());
        assertEquals(300L, byEmail.getDetails().get("retryAfter"));

        when(mapper.countByIpSince(anyString(), eq(900L))).thenReturn(40);
        assertThrows(BusinessException.class, () -> t.check("b@example.com", "1.1.1.1"));
        assertDoesNotThrow(() -> t.check("b@example.com", null)); // 没有 IP 时只按邮箱限制

        t.recordFailure("c@example.com", "2.2.2.2");
        verify(mapper).insert(eq("c@example.com"), argThat(h -> h != null && h.matches("[0-9a-f]{64}") && !h.contains("2.2.2.2")));
    }
}
