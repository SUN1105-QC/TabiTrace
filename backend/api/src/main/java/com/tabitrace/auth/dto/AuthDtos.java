package com.tabitrace.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class AuthDtos {
    private AuthDtos() {}
    /**
     * 密码规则与修改密码一致：8~100 位、不能全是空白；昵称为空时用邮箱前缀，规则见 UserService.normalizeNickname。
     * emailVerificationToken 来自 /auth/email-verification/verify，缺失或无效时由 EmailVerificationService 给出明确错误。
     */
    public record RegisterRequest(@Email @NotBlank String email, @NotBlank @Size(min=8,max=100) String password, @Size(max=100) String nickname,
                                  @Size(max=200) String emailVerificationToken) {}
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    public record LogoutRequest(String refreshToken) {}
    /** 当前用户的资料与设置；密码哈希等敏感字段不会出现在这里 */
    public record UserView(Long id,String email,String nickname,String avatarUrl,String bio,String locale,String timezone,String distanceUnit,
                           String defaultVisibility,boolean shareExactLocation,int shareLinkExpiryDays,
                           boolean emailNotifications,boolean notifyTripReminder,boolean notifyStory,boolean notifyAchievement,boolean notifyShare,
                           LocalDateTime createdAt) {}
    public record TokenResponse(String accessToken,String refreshToken,long expiresInSeconds,UserView user) {}
}
