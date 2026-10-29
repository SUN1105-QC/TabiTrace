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
    private final LoginThrottleService throttle;
    /** 邮箱不存在时也跑一次 BCrypt，避免通过响应时间判断邮箱是否注册 */
    private final String timingDummyHash;

    public AuthService(UserMapper users, RefreshTokenMapper refreshTokens, PasswordEncoder passwordEncoder, JwtService jwt,
                       EmailVerificationService verifications, LoginThrottleService throttle) {
        this.users=users; this.refreshTokens=refreshTokens; this.passwordEncoder=passwordEncoder; this.jwt=jwt;
        this.verifications=verifications; this.throttle=throttle;
        this.timingDummyHash=passwordEncoder.encode("tabitrace-login-timing-equalizer");
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
        // 注册时沿用用户在注册页正在使用的界面语言与设备时区，避免注册完成后界面被切回默认语言；无效值回退到默认
        u.locale=registerLocale(request.locale()); u.timezone=registerTimezone(request.timezone()); u.defaultVisibility="PRIVATE"; u.emailNotifications=false;
        // 并发注册同一邮箱时，以数据库 users.email 唯一约束为准
        try { users.insert(u); }
        catch(DuplicateKeyException ex) { throw emailExists(); }
        u=users.findById(u.id);
        return issue(u, userAgent, null);
    }

    static String registerLocale(String v) {
        try { return v == null ? DEFAULT_LOCALE : UserService.requireLocale(v); } catch (BusinessException ex) { return DEFAULT_LOCALE; }
    }

    static String registerTimezone(String v) {
        try { return v == null ? DEFAULT_TIMEZONE : UserService.requireTimezone(v); } catch (BusinessException ex) { return DEFAULT_TIMEZONE; }
    }

    private static final String DEFAULT_LOCALE = "zh-CN", DEFAULT_TIMEZONE = "Asia/Tokyo";

    private static BusinessException emailExists() { return new BusinessException("EMAIL_EXISTS","该邮箱已经注册", HttpStatus.CONFLICT); }

    /** 与个人设置中的昵称规则一致（去空白、最多 30 字）；未填写时取邮箱 @ 前的部分，同样截到 30 字 */
    static String registerNickname(String raw, String email) {
        if (raw != null && !raw.isBlank()) return UserService.normalizeNickname(raw);
        String prefix = email.substring(0, email.indexOf('@'));
        return prefix.codePointCount(0, prefix.length()) <= UserService.NICKNAME_MAX ? prefix : prefix.substring(0, prefix.offsetByCodePoints(0, UserService.NICKNAME_MAX));
    }

    public TokenResponse login(LoginRequest request) { return login(request, null, null); }

    /**
     * 登录：先做频率限制，再校验密码。邮箱不存在与密码错误返回同一个错误，并且都会计入失败次数。
     * 失败记录必须保留，所以业务异常不回滚。
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public TokenResponse login(LoginRequest request, String userAgent, String clientIp) {
        String email=request.email().trim().toLowerCase();
        throttle.check(email, clientIp);
        UserEntity u=users.findByEmail(email);
        boolean ok = u!=null ? passwordEncoder.matches(request.password(),u.passwordHash) : dummyMatch(request.password());
        if(!ok) {
            throttle.recordFailure(email, clientIp);
            throw new BusinessException("INVALID_CREDENTIALS","邮箱或密码不正确", HttpStatus.UNAUTHORIZED);
        }
        // 注销冷静期：密码正确才告诉用户账号在冷静期，确认撤销后恢复账号并登录
        if(UserService.STATUS_DELETION_PENDING.equals(u.status)) {
            if(!Boolean.TRUE.equals(request.cancelDeletion()))
                throw new BusinessException("ACCOUNT_DELETION_PENDING","这个账号已申请注销",HttpStatus.FORBIDDEN,
                        java.util.Map.of("scheduledAt",String.valueOf(u.deletionScheduledAt)));
            users.cancelDeletion(u.id);
            u=users.findById(u.id);
        }
        if(!"ACTIVE".equals(u.status)) throw new BusinessException("USER_DISABLED","账号当前不可用",HttpStatus.FORBIDDEN);
        throttle.clear(email);
        return issue(u, userAgent, null);
    }

    private boolean dummyMatch(String password) {
        if(timingDummyHash!=null) passwordEncoder.matches(password, timingDummyHash);
        return false;
    }

    /**
     * 忘记密码：用 purpose=RESET_PASSWORD 的邮箱验证令牌设置新密码。
     * 成功后撤销该账号所有已登录设备，再为当前设备签发新会话（等同重新登录）。
     * 令牌不存在 / 账号不可用时统一返回“验证已失效”，不暴露账号状态。
     */
    @Transactional
    public TokenResponse resetPassword(PasswordResetRequest request, String userAgent) {
        String email=EmailVerificationService.normalizeEmail(request.email());
        verifications.consume(request.emailVerificationToken(), email, VerificationPurpose.RESET_PASSWORD);
        UserEntity u=users.findByEmail(email);
        if(u==null || !"ACTIVE".equals(u.status))
            throw new BusinessException("EMAIL_TOKEN_INVALID","邮箱验证已失效，请重新获取验证码");
        users.updatePassword(u.id, passwordEncoder.encode(request.newPassword()));
        refreshTokens.revokeAll(u.id);
        throttle.clear(email);
        return issue(users.findById(u.id), userAgent, null);
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
        if(!"ACTIVE".equals(u.status)) throw new BusinessException("REFRESH_TOKEN_REVOKED","Refresh Token 已失效",HttpStatus.UNAUTHORIZED);
        refreshTokens.revoke(claims.getId());
        // 刷新是同一台设备的延续：沿用首次登录时间与会话编号，设备信息以本次请求为准
        LocalDateTime started=stored.sessionStartedAt!=null?stored.sessionStartedAt:stored.createdAt;
        return issue(u, userAgent!=null?userAgent:stored.userAgent, started, stored.sessionId!=null?stored.sessionId:stored.jti);
    }

    @Transactional
    public void logout(Long userId, LogoutRequest request) { logout(userId, null, request); }

    /** 只退出当前设备：优先用 refresh token（Cookie）识别，其次用访问令牌里的 sid；都没有时才退出该用户全部设备（旧令牌兼容） */
    @Transactional
    public void logout(Long userId, String sid, LogoutRequest request) {
        if(request!=null && request.refreshToken()!=null && !request.refreshToken().isBlank()) {
            try { refreshTokens.revoke(jwt.parse(request.refreshToken()).getId()); return; } catch(Exception ignored) {}
        }
        if(sid!=null && !sid.isBlank()) { refreshTokens.revoke(sid); return; }
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

    private TokenResponse issue(UserEntity u, String userAgent, LocalDateTime sessionStartedAt) { return issue(u, userAgent, sessionStartedAt, null); }

    /** sessionId 为空时开始一个新的登录会话 */
    private TokenResponse issue(UserEntity u, String userAgent, LocalDateTime sessionStartedAt, String sessionId) {
        JwtService.TokenWithJti refresh=jwt.createRefreshToken(u.id,u.email);
        String session=sessionId!=null?sessionId:java.util.UUID.randomUUID().toString();
        String access=jwt.createAccessToken(u.id,u.email,refresh.jti(),session);
        RefreshTokenEntity e=new RefreshTokenEntity(); e.userId=u.id; e.jti=refresh.jti(); e.sessionId=session;
        e.userAgent=userAgent==null?null:userAgent.substring(0,Math.min(255,userAgent.length()));
        e.sessionStartedAt=sessionStartedAt!=null?sessionStartedAt:LocalDateTime.now(ZoneOffset.UTC);
        e.expiresAt=LocalDateTime.ofInstant(refresh.expiresAt(), ZoneOffset.UTC); refreshTokens.insert(e);
        return new TokenResponse(access,refresh.token(),jwt.accessTtl().toSeconds(),view(u));
    }

    public static UserView view(UserEntity u){
        return new UserView(u.id,u.email,u.nickname,u.avatarUrl,u.avatarSmallUrl,u.bio,u.locale,u.timezone,u.distanceUnit==null?"KM":u.distanceUnit,
                u.defaultVisibility,Boolean.TRUE.equals(u.shareExactLocation),u.shareLinkExpiryDays==null?0:u.shareLinkExpiryDays,
                Boolean.TRUE.equals(u.emailNotifications),!Boolean.FALSE.equals(u.notifyTripReminder),!Boolean.FALSE.equals(u.notifyStory),
                false,!Boolean.FALSE.equals(u.notifyShare),u.createdAt,
                u.lifetimeProAt!=null,u.lifetimeProAt);
    }
}
