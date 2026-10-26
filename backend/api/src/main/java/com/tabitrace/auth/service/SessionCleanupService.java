package com.tabitrace.auth.service;

import com.tabitrace.auth.mapper.RefreshTokenMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** refresh_tokens 清理：过期或撤销超过 7 天的记录直接删除（设备管理只显示有效会话），避免表无限增长 */
@Service
public class SessionCleanupService {
    private static final Logger log = LoggerFactory.getLogger(SessionCleanupService.class);
    static final int KEEP_DAYS = 7;
    static final int BATCH = 5000;
    private final RefreshTokenMapper refreshTokens;

    public SessionCleanupService(RefreshTokenMapper refreshTokens) { this.refreshTokens = refreshTokens; }

    @Scheduled(cron = "${app.sessions.cleanup-cron:0 47 * * * *}")
    public int cleanup() {
        int total = 0, n;
        // 分批删除，单条语句不会长时间锁表
        do { n = refreshTokens.deleteStale(KEEP_DAYS, BATCH); total += n; } while (n == BATCH);
        if (total > 0) log.info("SESSIONS: 清理过期 / 已撤销的登录记录 {} 条", total);
        return total;
    }
}
