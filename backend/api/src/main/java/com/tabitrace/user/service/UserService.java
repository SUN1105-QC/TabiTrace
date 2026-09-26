package com.tabitrace.user.service;

import com.tabitrace.auth.dto.AuthDtos.UserView;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.dto.UserDtos.*;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.AccountMapper;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 设置中心：资料、偏好、隐私、通知只更新当前登录用户（userId 一律来自登录态，不读请求体）。
 * 前端校验只是体验，所有规则在这里再校验一遍。
 */
@Service
public class UserService {
    public static final int NICKNAME_MAX = 30;
    public static final int BIO_MAX = 120;
    public static final Set<String> LOCALES = Set.of("zh-CN", "ja-JP", "en-US");
    public static final Set<String> DISTANCE_UNITS = Set.of("KM", "MI");
    /** 分享链接默认有效期（天），0 表示长期有效 */
    public static final Set<Integer> SHARE_EXPIRY_DAYS = Set.of(0, 7, 30);
    public static final Set<String> VISIBILITIES = Set.of("PRIVATE", "UNLISTED");
    static final Set<String> AVATAR_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    static final long AVATAR_MAX_BYTES = 5L * 1024 * 1024;

    private final UserMapper mapper;
    private final AccountMapper accounts;
    private final RefreshTokenMapper refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final StorageService storage;

    public UserService(UserMapper mapper, AccountMapper accounts, RefreshTokenMapper refreshTokens, PasswordEncoder passwordEncoder, StorageService storage) {
        this.mapper = mapper; this.accounts = accounts; this.refreshTokens = refreshTokens; this.passwordEncoder = passwordEncoder; this.storage = storage;
    }

    public UserView get(Long id) { return AuthService.view(require(id)); }

    @Transactional
    public UserView update(Long id, UpdateUserRequest r) {
        UserEntity u = require(id);
        if (r.nickname() != null) u.nickname = normalizeNickname(r.nickname());
        if (r.bio() != null) u.bio = normalizeBio(r.bio());
        if (r.locale() != null) u.locale = requireLocale(r.locale());
        if (r.timezone() != null) u.timezone = requireTimezone(r.timezone());
        if (r.distanceUnit() != null) u.distanceUnit = requireDistanceUnit(r.distanceUnit());
        if (r.defaultVisibility() != null) u.defaultVisibility = requireVisibility(r.defaultVisibility());
        if (r.shareExactLocation() != null) u.shareExactLocation = r.shareExactLocation();
        if (r.shareLinkExpiryDays() != null) u.shareLinkExpiryDays = requireExpiryDays(r.shareLinkExpiryDays());
        if (r.emailNotifications() != null) u.emailNotifications = r.emailNotifications();
        if (r.notifyTripReminder() != null) u.notifyTripReminder = r.notifyTripReminder();
        if (r.notifyStory() != null) u.notifyStory = r.notifyStory();
        if (r.notifyAchievement() != null) u.notifyAchievement = r.notifyAchievement();
        if (r.notifyShare() != null) u.notifyShare = r.notifyShare();
        mapper.updateProfile(u);
        return AuthService.view(require(id));
    }

    /** 账户概览：旅行统计 + 每段旅行的 FREE / PRO 状态（Trip Pro 按单段旅行购买） */
    public AccountOverview overview(Long userId) {
        require(userId);
        List<TripPlanView> plans = accounts.tripPlans(userId).stream()
                .map(p -> new TripPlanView(p.tripId, p.title, p.destinationName, p.startDate, p.endDate, p.planType, p.status, p.amount, p.currency, p.provider, p.paidAt))
                .toList();
        int pro = (int) plans.stream().filter(p -> "PRO".equals(p.planType())).count();
        return new AccountOverview(accounts.countTrips(userId), accounts.countPlaces(userId), accounts.countPhotos(userId), pro,
                accounts.countActiveFreeTrips(userId), TripService.FREE_ACTIVE_TRIP_LIMIT,
                PaymentService.TRIP_PRO_AMOUNT / 100, PaymentService.TRIP_PRO_CURRENCY, plans);
    }

    /** 修改密码：校验当前密码，成功后退出其他设备（当前设备保持登录），返回退出的设备数 */
    @Transactional
    public int changePassword(Long userId, String currentJti, ChangePasswordRequest r) {
        UserEntity u = require(userId);
        if (!passwordEncoder.matches(r.currentPassword(), u.passwordHash)) throw new BusinessException("INVALID_PASSWORD", "当前密码不正确");
        if (r.newPassword().isBlank() || r.newPassword().length() < 8) throw new BusinessException("WEAK_PASSWORD", "新密码至少需要 8 位");
        if (passwordEncoder.matches(r.newPassword(), u.passwordHash)) throw new BusinessException("PASSWORD_UNCHANGED", "新密码不能与当前密码相同");
        mapper.updatePassword(userId, passwordEncoder.encode(r.newPassword()));
        return currentJti == null ? refreshTokens.revokeAll(userId) : refreshTokens.revokeOthers(userId, currentJti);
    }

    /** 头像沿用照片的上传通道，只是存储路径放在用户自己的 avatar 目录下 */
    public PresignResponse presignAvatar(Long userId, AvatarPresignRequest r) {
        require(userId);
        String type = r.contentType().trim().toLowerCase();
        if (!AVATAR_TYPES.contains(type)) throw new BusinessException("INVALID_AVATAR_TYPE", "头像仅支持 JPG、PNG 或 WebP 图片");
        if (r.fileSize() != null && r.fileSize() > AVATAR_MAX_BYTES) throw new BusinessException("AVATAR_TOO_LARGE", "头像图片不能超过 5MB");
        return storage.presignKey(avatarPrefix(userId) + UUID.randomUUID() + "." + StorageService.extensionFor(type), type);
    }

    @Transactional
    public UserView setAvatar(Long userId, String storageKey) {
        require(userId);
        if (storageKey == null || !storageKey.startsWith(avatarPrefix(userId)) || storageKey.contains(".."))
            throw new BusinessException("INVALID_STORAGE_KEY", "头像存储路径不属于当前账户");
        if (!storage.exists(storageKey)) throw new BusinessException("AVATAR_UPLOAD_MISSING", "请先完成头像上传");
        mapper.updateAvatar(userId, storage.publicUrl(storageKey));
        return get(userId);
    }

    @Transactional
    public UserView removeAvatar(Long userId) {
        require(userId);
        mapper.updateAvatar(userId, null);
        return get(userId);
    }

    static String avatarPrefix(Long userId) { return "users/" + userId + "/avatar/"; }

    // ---- 校验规则（静态，便于单元测试） ----

    public static String normalizeNickname(String raw) {
        String v = raw.trim().replaceAll("\\s+", " ");
        if (v.isEmpty()) throw new BusinessException("INVALID_NICKNAME", "昵称不能为空");
        if (v.codePointCount(0, v.length()) > NICKNAME_MAX) throw new BusinessException("INVALID_NICKNAME", "昵称最多 " + NICKNAME_MAX + " 个字");
        return v;
    }

    /** 空简介保存为 null */
    public static String normalizeBio(String raw) {
        String v = raw.trim();
        if (v.isEmpty()) return null;
        if (v.codePointCount(0, v.length()) > BIO_MAX) throw new BusinessException("INVALID_BIO", "个人简介最多 " + BIO_MAX + " 个字");
        return v;
    }

    public static String requireLocale(String v) {
        if (!LOCALES.contains(v)) throw new BusinessException("INVALID_LOCALE", "不支持的语言");
        return v;
    }

    /** 只接受 IANA 时区名（如 Asia/Tokyo），不接受 +09:00 这类固定偏移 */
    public static String requireTimezone(String v) {
        if (!ZoneId.getAvailableZoneIds().contains(v)) throw new BusinessException("INVALID_TIMEZONE", "时区不正确");
        return v;
    }

    public static String requireDistanceUnit(String v) {
        if (!DISTANCE_UNITS.contains(v)) throw new BusinessException("INVALID_DISTANCE_UNIT", "距离单位不正确");
        return v;
    }

    public static String requireVisibility(String v) {
        if (!VISIBILITIES.contains(v)) throw new BusinessException("INVALID_VISIBILITY", "可见性不正确");
        return v;
    }

    public static int requireExpiryDays(int v) {
        if (!SHARE_EXPIRY_DAYS.contains(v)) throw new BusinessException("INVALID_SHARE_EXPIRY", "分享链接有效期不正确");
        return v;
    }

    private UserEntity require(Long id) {
        UserEntity u = mapper.findById(id);
        if (u == null) throw new BusinessException("USER_NOT_FOUND", "用户不存在");
        return u;
    }
}
