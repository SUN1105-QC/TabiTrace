package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {
    private final AdminMapper mapper;
    private final UserMapper users;
    private final TripMapper trips;
    private final RefreshTokenMapper sessions;
    public AdminService(AdminMapper mapper, UserMapper users, TripMapper trips, RefreshTokenMapper sessions) {
        this.mapper = mapper;
        this.users = users;
        this.trips = trips;
        this.sessions = sessions;
    }

    public void requireAdmin(Long id) {
        UserEntity u = users.findById(id);
        if (u == null || !"ADMIN".equals(u.role) || !"ACTIVE".equals(u.status)) {
            throw new BusinessException("ADMIN_REQUIRED", "仅管理员可执行此操作", HttpStatus.FORBIDDEN);
        }
    }

    /** 所有新增管理写入复用同一管理员行锁；须在 READ_COMMITTED 事务内调用。 */
    public void lockForWrite(Long id) {
        requireAdmin(id);
        var locked=users.lockById(id);
        if (locked==null || !"ADMIN".equals(locked.role) || !"ACTIVE".equals(locked.status))
            throw new BusinessException("ADMIN_REQUIRED","仅管理员可执行此操作",HttpStatus.FORBIDDEN);
        if (mapper.recentPermissionUpdates(id)>=60)
            throw new BusinessException("ADMIN_UPDATE_LIMIT","管理操作过于频繁，请一分钟后重试",HttpStatus.TOO_MANY_REQUESTS);
    }

    public Overview overview(Long adminId) {
        requireAdmin(adminId);
        return mapper.overview();
    }

    public UserPage users(Long adminId, String q, int page) {
        return users(adminId, q, "", page, 25);
    }

    public UserPage users(Long adminId, String q, String status, int page, int pageSize) {
        requireAdmin(adminId);
        if (!java.util.Set.of(10, 25, 50).contains(pageSize) || page < 1 || page > 1000000
                || !java.util.Set.of("", "ACTIVE", "DISABLED", "DELETION_PENDING").contains(status)) {
            throw new BusinessException("INVALID_PAGE_FILTER", "分页或状态筛选参数无效");
        }
        return new UserPage(mapper.users(q.strip(), status, (page - 1) * pageSize, pageSize).stream().map(AdminService::view).toList(),
                mapper.userCount(q.strip(), status), page, pageSize);
    }

    public UserView user(Long adminId, Long id) {
        requireAdmin(adminId);
        UserRow row = mapper.user(id);
        if (row == null) throw new BusinessException("USER_NOT_FOUND", "用户不存在或不是普通用户", HttpStatus.NOT_FOUND);
        return view(row);
    }

    // 等待管理员行锁后须读取最新已提交的审计计数，不能沿用事务开始时的旧快照。
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public UserView update(Long adminId, Long id, UpdateUserRequest r) {
        requireAdmin(adminId);
        // 唯一管理员行将权限写入串行化，避免多个管理标签页突破每分钟写入限额。
        users.lockById(adminId);
        UserEntity u = users.lockById(id);
        if (u == null) throw new BusinessException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        if (!"USER".equals(u.role)) {
            throw new BusinessException("ADMIN_PROTECTED", "唯一管理员的身份不能变更", HttpStatus.FORBIDDEN);
        }
        if ("DELETION_PENDING".equals(u.status)) {
            throw new BusinessException("ACCOUNT_DELETION_PENDING", "用户已申请注销，不能更改其状态和权限", HttpStatus.CONFLICT);
        }
        // 使用既有微秒时间戳做乐观锁，不新增列；比较必须在账号行锁内部完成。
        if (r.expectedUpdatedAt() == null || !r.expectedUpdatedAt().equals(u.updatedAt)) {
            throw new BusinessException("ADMIN_USER_CHANGED", "用户资料已更新，请重新加载最新资料后再保存", HttpStatus.CONFLICT);
        }
        if (mapper.recentPermissionUpdates(adminId) >= 60) {
            throw new BusinessException("ADMIN_UPDATE_LIMIT", "权限修改过于频繁，请一分钟后重试", HttpStatus.TOO_MANY_REQUESTS);
        }
        if (r.userLevel() == null || r.userLevel().isBlank() || r.userLevel().length() > 40
                || r.tripLimit() < 1 || r.tripLimit() > 100000 || r.tripRetentionMonths() < 1 || r.tripRetentionMonths() > 1200
                || r.canShare() == null || r.canVideo() == null
                || !java.util.Set.of("INHERIT", "ALLOW", "DENY").contains(r.customMusicAccess() == null ? "" : r.customMusicAccess())
                || !java.util.Set.of("ACTIVE", "DISABLED").contains(r.status() == null ? "" : r.status())) {
            throw new BusinessException("INVALID_USER_PERMISSIONS", "等级、配额或权限字段不合法");
        }
        mapper.updateUser(id, new UpdateUserRequest(r.userLevel().strip(), r.tripLimit(), r.tripRetentionMonths(),
                r.canShare(), r.canVideo(), r.customMusicAccess(), r.status(), r.expectedUpdatedAt()));
        // 只重算未过期旅程的到期时间，物理清理仍由既有定时任务执行。
        if (!u.tripRetentionMonths.equals(r.tripRetentionMonths())) trips.updateRetention(id, r.tripRetentionMonths());
        if ("DISABLED".equals(r.status())) sessions.revokeAll(id);
        mapper.audit(adminId, id, "UPDATE_USER", "requestId=" + java.util.UUID.randomUUID() + ";result=SUCCESS;before=" + u.userLevel + "," + u.tripLimit + ","
                + u.tripRetentionMonths + "," + u.status + "," + u.canShare + "," + u.canVideo + ","
                + u.customMusicAccess + ";after=" + r);
        return view(mapper.user(id));
    }

    static UserView view(UserRow u) {
        return new UserView(u.id, u.email, u.nickname, u.role, u.status, u.userLevel, u.tripLimit, u.tripRetentionMonths,
                Boolean.TRUE.equals(u.canShare), Boolean.TRUE.equals(u.canVideo), u.customMusicAccess,
                u.trips, u.photos, u.createdAt, u.avatarSmallUrl != null ? u.avatarSmallUrl : u.avatarUrl, u.updatedAt,
                u.deletionScheduledAt,Boolean.TRUE.equals(u.deletionRequestedByAdmin),u.deletionPreviousStatus);
    }
}
