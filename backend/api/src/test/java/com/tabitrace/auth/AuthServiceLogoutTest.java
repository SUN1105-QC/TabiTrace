package com.tabitrace.auth;

import com.tabitrace.auth.dto.AuthDtos.LogoutRequest;
import com.tabitrace.verification.service.EmailVerificationService;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.mapper.UserMapper;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceLogoutTest {
    @Test
    void refreshTokenCanBeRevokedWithoutAccessToken() {
        UserMapper users = mock(UserMapper.class);
        RefreshTokenMapper refreshTokens = mock(RefreshTokenMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        Claims claims = mock(Claims.class);
        when(jwt.parse("refresh-token")).thenReturn(claims);
        when(claims.getId()).thenReturn("refresh-jti");

        AuthService service = new AuthService(users, refreshTokens, passwordEncoder, jwt, mock(EmailVerificationService.class));
        service.logout(null, new LogoutRequest("refresh-token"));

        verify(refreshTokens).revoke("refresh-jti");
        verify(refreshTokens, never()).revokeAll(any());
    }

    @Test
    void anonymousLogoutWithoutRefreshTokenIsIdempotent() {
        AuthService service = new AuthService(
                mock(UserMapper.class),
                mock(RefreshTokenMapper.class),
                mock(PasswordEncoder.class),
                mock(JwtService.class),
                mock(EmailVerificationService.class));
        service.logout(null, null);
    }
}
