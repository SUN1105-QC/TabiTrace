package com.tabitrace.verification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class EmailVerificationDtos {
    private EmailVerificationDtos() {}
    /** purpose 接受 register / REGISTER 等写法 */
    public record SendCodeRequest(@Email @NotBlank @Size(max = 255) String email, @NotBlank String purpose) {}
    public record VerifyCodeRequest(@Email @NotBlank @Size(max = 255) String email,
                                    @NotBlank @Pattern(regexp = "\\d{6}", message = "验证码是 6 位数字") String code,
                                    @NotBlank String purpose) {}
    /** 只返回有效期与重发间隔，绝不返回验证码 */
    public record SendCodeResponse(long expiresIn, long resendAfter) {}
    public record VerifyCodeResponse(String emailVerificationToken, long expiresIn) {}
}
