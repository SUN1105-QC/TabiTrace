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
                                  @Size(max=200) String emailVerificationToken, @Size(max=20) String locale, @Size(max=50) String timezone) {
        public RegisterRequest(String email, String password, String nickname, String emailVerificationToken) { this(email, password, nickname, emailVerificationToken, null, null); }
    }
    /** cancelDeletion：账号处于注销冷静期时，用户确认撤销注销后带上 true 重新提交 */
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password, Boolean cancelDeletion) {
        public LoginRequest(String email, String password) { this(email, password, null); }
    }
    /** 忘记密码：新密码规则与注册、修改密码一致（8~100 位、不能全是空白） */
    public record PasswordResetRequest(@Email @NotBlank String email, @NotBlank @Size(min=8,max=100) String newPassword, @Size(max=200) String emailVerificationToken) {}
    /** 浏览器通过 HttpOnly Cookie 提交 refresh token；请求体仅为兼容保留 */
    public record RefreshRequest(String refreshToken) {}
    public record LogoutRequest(String refreshToken) {}
    /** 当前用户的资料与设置；密码哈希等敏感字段不会出现在这里 */
    public record UserView(Long id,String email,String nickname,String avatarUrl,String avatarSmallUrl,String bio,String locale,String timezone,String distanceUnit,
                           String defaultVisibility,boolean shareExactLocation,int shareLinkExpiryDays,
                           boolean emailNotifications,boolean notifyTripReminder,boolean notifyStory,boolean notifyAchievement,boolean notifyShare,
                           LocalDateTime createdAt,
                           /** 买断终身 Pro：账号下所有旅行都是 PRO */
                           boolean lifetimePro,LocalDateTime lifetimeProAt) {}
    /** refreshToken 只在服务端内部传递，写入 Cookie 后从响应 JSON 中去掉（non_null 序列化） */
    public record TokenResponse(String accessToken,String refreshToken,long expiresInSeconds,UserView user) {}
}
