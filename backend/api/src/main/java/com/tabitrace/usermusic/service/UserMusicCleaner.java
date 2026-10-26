package com.tabitrace.usermusic.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 「我的音乐」异步清理：
 * - 拿到上传地址后长时间没有完成的上传，标记删除
 * - 已删除 / 处理失败的音乐，等用到它的视频生成结束后再删存储文件（不会影响排队中的视频）
 * 会员到期不会触发删除：音乐转为只读，用户仍可查看、试听、删除。
 */
@Component
public class UserMusicCleaner {
    private static final Logger log = LoggerFactory.getLogger(UserMusicCleaner.class);
    private final UserMusicService service;
    public UserMusicCleaner(UserMusicService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${app.user-music.cleanup-interval-ms:600000}", initialDelayString = "${app.user-music.cleanup-interval-ms:600000}")
    public void run() {
        try {
            int n = service.cleanup();
            if (n > 0) log.info("USER_MUSIC: 清理了 {} 个已删除音乐的文件", n);
        } catch (RuntimeException ex) {
            log.warn("USER_MUSIC: 清理失败 reason={}", ex.getMessage());
        }
    }
}
