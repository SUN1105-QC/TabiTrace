package com.tabitrace.user.service;

import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.user.dto.UserDtos.AccountDeletionView;
import com.tabitrace.user.dto.UserDtos.DeleteAccountRequest;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.usermusic.service.UserMusicService;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 注销账号（7 天冷静期）：
 * 1. 申请：校验密码 → 账号进入 DELETION_PENDING → 撤销全部登录会话（所有设备立即退出，旧访问令牌同时失效）
 * 2. 冷静期内重新登录：密码正确后提示「已申请注销」，用户确认撤销即恢复账号（见 AuthService.login）
 * 3. 到期：定时任务先删除存储里属于该账号的全部文件（照片、头像、视频、音乐），成功后再删除账号；
 *    视频清理任务与账号删除同事务提交；付款与渠道事件保留归属快照，其他业务记录随外键级联删除。
 */
@Service
public class AccountDeletionService {
    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);
    public static final int COOLING_OFF_DAYS = 7;
    private final UserMapper users;
    private final RefreshTokenMapper refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final StorageService storage;
    private final VideoProjectMapper videos;
    private final TransactionTemplate transactions;

    public AccountDeletionService(UserMapper users, RefreshTokenMapper refreshTokens, PasswordEncoder passwordEncoder, StorageService storage,
                                  VideoProjectMapper videos, PlatformTransactionManager transactionManager) {
        this.users = users; this.refreshTokens = refreshTokens; this.passwordEncoder = passwordEncoder; this.storage = storage;
        this.videos = videos; this.transactions = new TransactionTemplate(transactionManager);
    }

    @Transactional
    public AccountDeletionView request(Long userId, DeleteAccountRequest r) {
        UserEntity u = users.findById(userId);
        if (u == null) throw new BusinessException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        if (!passwordEncoder.matches(r.password(), u.passwordHash)) throw new BusinessException("INVALID_PASSWORD", "密码不正确");
        LocalDateTime scheduledAt = LocalDateTime.now(ZoneOffset.UTC).plusDays(COOLING_OFF_DAYS);
        if (users.requestDeletion(userId, scheduledAt) == 0) throw new BusinessException("ACCOUNT_NOT_ACTIVE", "账号当前不能注销");
        refreshTokens.revokeAll(userId);
        log.info("ACCOUNT: 申请注销 userId={} scheduledAt={}", userId, scheduledAt);
        return new AccountDeletionView(scheduledAt, COOLING_OFF_DAYS);
    }

    /** 每小时检查一次到期的账号；每次最多处理 20 个，剩下的下一轮继续 */
    @Scheduled(cron = "${app.account-deletion.cron:0 23 * * * *}")
    public int purgeDue() {
        List<Long> due = users.listDueForDeletion(20);
        int done = 0;
        for (Long id : due) {
            try { if (purge(id)) done++; }
            catch (RuntimeException ex) { log.warn("ACCOUNT: 删除账号失败，下次重试 userId={} reason={}", id, ex.getMessage()); }
        }
        return done;
    }

    /** 先删文件再删账号：文件删除失败会抛异常，账号保留到下次重试 */
    boolean purge(Long userId) {
        // Explicit template: purgeDue invokes this method on the same instance, bypassing @Transactional proxies.
        boolean deleted = Boolean.TRUE.equals(transactions.execute(status -> {
            if (users.lockDueForDeletion(userId) == null) return false;
            for (var video : videos.lockByUser(userId)) videos.enqueueOutputDeletion(video);
            storage.deletePrefix("users/" + userId + "/");
            storage.deletePrefix(UserMusicService.KEY_PREFIX + userId + "/");
            if (users.deleteIfDue(userId) == 0) {
                status.setRollbackOnly();
                return false;
            }
            return true;
        }));
        if (deleted) log.info("ACCOUNT: 已删除账号 userId={}", userId);
        return deleted;
    }
}
