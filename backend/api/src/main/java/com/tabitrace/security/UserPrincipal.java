package com.tabitrace.security;

/** sid：当前访问令牌所属的登录会话（refresh token 的 jti），旧令牌没有该字段时为空 */
public record UserPrincipal(Long id, String email, String sid) {
    public UserPrincipal(Long id, String email) { this(id, email, null); }
}
