package com.tabitrace.security;

import com.tabitrace.auth.mapper.RefreshTokenMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 访问令牌校验：先验签与类型，再确认令牌所属的登录会话（sess）仍然有效——
 * 退出登录、在设备管理里移除、修改密码、注销账号后，旧的访问令牌立即不能再用（不用等 15 分钟过期）。
 * 部署前签发的旧令牌没有 sess，仍按原规则在有效期内可用。
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final RefreshTokenMapper sessions;
    public JwtAuthenticationFilter(JwtService jwtService, RefreshTokenMapper sessions) { this.jwtService = jwtService; this.sessions = sessions; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwtService.parse(header.substring(7));
                String session = claims.get("sess", String.class);
                Long userId = Long.valueOf(claims.getSubject());
                if ("ACCESS".equals(claims.get("type", String.class)) && (session == null || sessions.isSessionActive(session, userId))) {
                    UserPrincipal principal = new UserPrincipal(userId, claims.get("email", String.class), claims.get("sid", String.class));
                    var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
