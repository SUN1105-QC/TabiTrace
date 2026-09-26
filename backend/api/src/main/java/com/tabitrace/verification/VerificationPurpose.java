package com.tabitrace.verification;

import com.tabitrace.common.BusinessException;

import java.util.Locale;

/**
 * 邮箱验证码的用途。同一套基础设施按 purpose 隔离：验证码、令牌、频率限制都只在同一 purpose 内有效。
 * 目前只开放 REGISTER；RESET_PASSWORD / CHANGE_EMAIL 已预留，接入对应业务流程时再打开（见 EmailVerificationService.ENABLED）。
 */
public enum VerificationPurpose {
    REGISTER, RESET_PASSWORD, CHANGE_EMAIL;

    /** 接受 register / REGISTER / reset_password 等写法 */
    public static VerificationPurpose parse(String raw) {
        if (raw == null || raw.isBlank()) throw new BusinessException("INVALID_PURPOSE", "验证用途不正确");
        try { return valueOf(raw.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ex) { throw new BusinessException("INVALID_PURPOSE", "验证用途不正确"); }
    }
}
