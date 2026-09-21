package com.tabitrace.auth.service;

import com.tabitrace.auth.dto.AuthDtos.*;
import com.tabitrace.auth.entity.RefreshTokenEntity;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
public class AuthService {
    private final UserMapper users;
    private final RefreshTokenMapper refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;

    public AuthService(UserMapper users, RefreshTokenMapper refreshTokens, PasswordEncoder passwordEncoder, JwtService jwt) {
        this.users=users; this.refreshTokens=refreshTokens; this.passwordEncoder=passwordEncoder; this.jwt=jwt;
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        String email=request.email().trim().toLowerCase();
        if(users.findByEmail(email)!=null) throw new BusinessException("EMAIL_EXISTS","该邮箱已经注册");
        UserEntity u=new UserEntity();
        u.email=email; u.passwordHash=passwordEncoder.encode(request.password());
        u.nickname=(request.nickname()==null||request.nickname().isBlank())?email.substring(0,email.indexOf('@')):request.nickname().trim();
        u.locale="zh-CN"; u.timezone="Asia/Tokyo"; u.defaultVisibility="PRIVATE"; u.emailNotifications=true;
        users.insert(u);
        return issue(u);
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        UserEntity u=users.findByEmail(request.email().trim().toLowerCase());
        if(u==null||!passwordEncoder.matches(request.password(),u.passwordHash))
            throw new BusinessException("INVALID_CREDENTIALS","邮箱或密码不正确", HttpStatus.UNAUTHORIZED);
        if(!"ACTIVE".equals(u.status)) throw new BusinessException("USER_DISABLED","账号当前不可用",HttpStatus.FORBIDDEN);
        return issue(u);
    }

    @Transactional
    public TokenResponse refresh(RefreshRequest request) {
        Claims claims;
        try { claims=jwt.parse(request.refreshToken()); }
        catch(Exception ex){ throw new BusinessException("INVALID_REFRESH_TOKEN","Refresh Token 无效",HttpStatus.UNAUTHORIZED); }
        if(!"REFRESH".equals(claims.get("type",String.class))) throw new BusinessException("INVALID_REFRESH_TOKEN","Refresh Token 类型错误",HttpStatus.UNAUTHORIZED);
        RefreshTokenEntity stored=refreshTokens.findActive(claims.getId());
        if(stored==null) throw new BusinessException("REFRESH_TOKEN_REVOKED","Refresh Token 已失效",HttpStatus.UNAUTHORIZED);
        UserEntity u=users.findById(Long.valueOf(claims.getSubject()));
        if(u==null) throw new BusinessException("USER_NOT_FOUND","用户不存在",HttpStatus.UNAUTHORIZED);
        refreshTokens.revoke(claims.getId());
        return issue(u);
    }

    @Transactional
    public void logout(Long userId, LogoutRequest request) {
        if(request!=null && request.refreshToken()!=null && !request.refreshToken().isBlank()) {
            try { refreshTokens.revoke(jwt.parse(request.refreshToken()).getId()); return; } catch(Exception ignored) {}
        }
        // Logout is intentionally idempotent. Public /auth/logout may be called after
        // the access token has expired, so only revoke-all when an authenticated user exists.
        if(userId!=null) refreshTokens.revokeAll(userId);
    }

    private TokenResponse issue(UserEntity u) {
        String access=jwt.createAccessToken(u.id,u.email);
        JwtService.TokenWithJti refresh=jwt.createRefreshToken(u.id,u.email);
        RefreshTokenEntity e=new RefreshTokenEntity(); e.userId=u.id; e.jti=refresh.jti();
        e.expiresAt=LocalDateTime.ofInstant(refresh.expiresAt(), ZoneOffset.UTC); refreshTokens.insert(e);
        return new TokenResponse(access,refresh.token(),jwt.accessTtl().toSeconds(),view(u));
    }

    public static UserView view(UserEntity u){
        return new UserView(u.id,u.email,u.nickname,u.avatarUrl,u.locale,u.timezone,u.defaultVisibility,Boolean.TRUE.equals(u.emailNotifications));
    }
}
