package com.tabitrace.auth.service;

import com.tabitrace.auth.dto.AuthDtos.*;
import com.tabitrace.auth.entity.RefreshTokenEntity;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.user.service.UserService;
import com.tabitrace.verification.VerificationPurpose;
import com.tabitrace.verification.service.EmailVerificationService;
import org.springframework.dao.DuplicateKeyException;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tabitrace.user.dto.UserDtos.SessionView;
import java.time.LocalDateTime;
import java.util.List;
import java.time.ZoneOffset;

@Service
public class AuthService {
    private final UserMapper users;
    private final RefreshTokenMapper refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;
    private final EmailVerificationService verifications;

    public AuthService(UserMapper users, RefreshTokenMapper refreshTokens, PasswordEncoder passwordEncoder, JwtService jwt, EmailVerificationService verifications) {
        this.users=users; this.refreshTokens=refreshTokens; this.passwordEncoder=passwordEncoder; this.jwt=jwt; this.verifications=verifications;
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) { return register(request, null); }

    @Transactional
    public TokenResponse register(RegisterRequest request, String userAgent) {
        String email=EmailVerificationService.normalizeEmail(request.email());
        // 先一次性消费邮箱验证令牌（证明对这个邮箱的控制权），再判断是否已注册；后续任何失败都会让整个事务回滚，令牌不会被白白用掉
        verifications.consume(request.emailVerificationToken(), email, VerificationPurpose.REGISTER);
        if(users.findByEmail(email)!=null) throw emailExists();
        UserEntity u=new UserEntity();
        u.email=email; u.passwordHash=passwordEncoder.encode(request.password());
        u.nickname=registerNickname(request.nickname(), email);
        u.locale="zh-CN"; u.timezone="Asia/Tokyo"; u.defaultVisibility="PRIVATE"; u.emailNotifications=true;
        // 并发注册同一邮箱时，以数据库 users.email 唯一约束为准
        try { users.insert(u); }
        catch(DuplicateKeyException ex) { throw emailExists(); }
        u=users.findById(u.id);
        return issue(u, userAgent, null);
    }

    private static BusinessException emailExists() { return new BusinessException("EMAIL_EXISTS","该邮箱已经注册", HttpStatus.CONFLICT); }

    /** 与个人设置中的昵称规则一致（去空白、最多 30 字）；未填写时取邮箱 @ 前的部分，同样截到 30 字 */
    static String registerNickname(String raw, String email) {
        if (raw != null && !raw.isBlank()) return UserService.normalizeNickname(raw);
        String prefix = email.substring(0, email.indexOf('@'));
        return prefix.codePointCount(0, prefix.length()) <= UserService.NICKNAME_MAX ? prefix : prefix.substring(0, prefix.offsetByCodePoints(0, UserService.NICKNAME_MAX));
    }

    @Transactional
    public TokenResponse login(LoginRequest request) { return login(request, null); }

    @Transactional
    public TokenResponse login(LoginRequest request, String userAgent) {
        UserEntity u=users.findByEmail(request.email().trim().toLowerCase());
        if(u==null||!passwordEncoder.matches(request.password(),u.passwordHash))
            throw new BusinessException("INVALID_CREDENTIALS","邮箱或密码不正确", HttpStatus.UNAUTHORIZED);
        if(!"ACTIVE".equals(u.status)) throw new BusinessException("USER_DISABLED","账号当前不可用",HttpStatus.FORBIDDEN);
        return issue(u, userAgent, null);
    }

    @Transactional
    public TokenResponse refresh(RefreshRequest request) { return refresh(request, null); }

    @Transactional
    public TokenResponse refresh(RefreshRequest request, String userAgent) {
        Claims claims;
        try { claims=jwt.parse(request.refreshToken()); }
        catch(Exception ex){ throw new BusinessException("INVALID_REFRESH_TOKEN","Refresh Token 无效",HttpStatus.UNAUTHORIZED); }
        if(!"REFRESH".equals(claims.get("type",String.class))) throw new BusinessException("INVALID_REFRESH_TOKEN","Refresh Token 类型错误",HttpStatus.UNAUTHORIZED);
        RefreshTokenEntity stored=refreshTokens.findActive(claims.getId());
        if(stored==null) throw new BusinessException("REFRESH_TOKEN_REVOKED","Refresh Token 已失效",HttpStatus.UNAUTHORIZED);
        UserEntity u=users.findById(Long.valueOf(claims.getSubject()));
        if(u==null) throw new BusinessException("USER_NOT_FOUND","用户不存在",HttpStatus.UNAUTHORIZED);
        refreshTokens.revoke(claims.getId());
        // 刷新是同一台设备的延续：沿用首次登录时间，设备信息以本次请求为准
        LocalDateTime started=stored.sessionStartedAt!=null?stored.sessionStartedAt:stored.createdAt;
        return issue(u, userAgent!=null?userAgent:stored.userAgent, started);
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

    /** 当前设备的会话：优先取访问令牌里的 sid；旧令牌没有 sid 时，用前端提交的本机 refresh token 识别（必须属于同一用户） */
    public String currentSessionJti(Long userId, String sid, String refreshToken) {
        if(sid!=null && !sid.isBlank()) return sid;
        if(refreshToken==null || refreshToken.isBlank()) return null;
        try {
            Claims c=jwt.parse(refreshToken);
            if("REFRESH".equals(c.get("type",String.class)) && String.valueOf(userId).equals(c.getSubject())) return c.getId();
        } catch(Exception ignored) {}
        return null;
    }

    public List<SessionView> sessions(Long userId, String currentJti) {
        return refreshTokens.listActive(userId).stream().map(t -> {
            UserAgentLabel.Device d=UserAgentLabel.parse(t.userAgent);
            return new SessionView(t.id,d.label(),d.mobile(),t.sessionStartedAt!=null?t.sessionStartedAt:t.createdAt,t.createdAt,t.expiresAt,t.jti.equals(currentJti));
        }).toList();
    }

    /** 退出某一台其他设备；当前设备请使用退出登录 */
    @Transactional
    public void revokeSession(Long userId, Long sessionId, String currentJti) {
        RefreshTokenEntity target=refreshTokens.listActive(userId).stream().filter(t -> t.id.equals(sessionId)).findFirst()
                .orElseThrow(() -> new BusinessException("SESSION_NOT_FOUND","该登录设备不存在或已退出",HttpStatus.NOT_FOUND));
        if(target.jti.equals(currentJti)) throw new BusinessException("SESSION_IS_CURRENT","当前设备请使用“退出当前账户”");
        refreshTokens.revokeById(userId,sessionId);
    }

    /** 退出除当前设备以外的全部设备，返回退出的数量 */
    @Transactional
    public int revokeOtherSessions(Long userId, String currentJti) {
        if(currentJti==null) throw new BusinessException("SESSION_UNKNOWN","无法识别当前设备，请刷新页面后重试");
        return refreshTokens.revokeOthers(userId,currentJti);
    }

    private TokenResponse issue(UserEntity u, String userAgent, LocalDateTime sessionStartedAt) {
        JwtService.TokenWithJti refresh=jwt.createRefreshToken(u.id,u.email);
        String access=jwt.createAccessToken(u.id,u.email,refresh.jti());
        RefreshTokenEntity e=new RefreshTokenEntity(); e.userId=u.id; e.jti=refresh.jti();
        e.userAgent=userAgent==null?null:userAgent.substring(0,Math.min(255,userAgent.length()));
        e.sessionStartedAt=sessionStartedAt!=null?sessionStartedAt:LocalDateTime.now(ZoneOffset.UTC);
        e.expiresAt=LocalDateTime.ofInstant(refresh.expiresAt(), ZoneOffset.UTC); refreshTokens.insert(e);
        return new TokenResponse(access,refresh.token(),jwt.accessTtl().toSeconds(),view(u));
    }

    public static UserView view(UserEntity u){
        return new UserView(u.id,u.email,u.nickname,u.avatarUrl,u.bio,u.locale,u.timezone,u.distanceUnit==null?"KM":u.distanceUnit,
                u.defaultVisibility,Boolean.TRUE.equals(u.shareExactLocation),u.shareLinkExpiryDays==null?0:u.shareLinkExpiryDays,
                Boolean.TRUE.equals(u.emailNotifications),!Boolean.FALSE.equals(u.notifyTripReminder),!Boolean.FALSE.equals(u.notifyStory),
                !Boolean.FALSE.equals(u.notifyAchievement),!Boolean.FALSE.equals(u.notifyShare),u.createdAt);
    }
}
