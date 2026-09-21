package com.tabitrace.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(@Email @NotBlank String email, @Size(min=8,max=100) String password, @Size(max=100) String nickname) {}
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    public record LogoutRequest(String refreshToken) {}
    public record UserView(Long id,String email,String nickname,String avatarUrl,String locale,String timezone,String defaultVisibility,boolean emailNotifications) {}
    public record TokenResponse(String accessToken,String refreshToken,long expiresInSeconds,UserView user) {}
}
