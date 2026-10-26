package com.tabitrace.usermusic.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 「我的音乐」的全部限制集中在这里（application.yml 的 app.user-music.*），前端从 /user/music 接口读取同一份数值，
 * 不在代码各处散落硬编码。
 */
@Component
public class UserMusicProperties {
    /** 单个文件上限（字节），默认 30MB；本地存储上传接口也按它限制 */
    public final long maxFileBytes;
    /** 每个账号最多保存的音乐数 */
    public final int maxTracks;
    /** 每个账号的音乐总容量（字节），默认 500MB */
    public final long maxTotalBytes;
    public final int minDurationSeconds;
    public final int maxDurationSeconds;
    /** 试听地址有效期 */
    public final long playUrlTtlSeconds;
    /** 拿到上传地址后多久没完成就视为放弃 */
    public final int abandonAfterMinutes;
    /** 会员到期后音乐至少保留的天数（只读，可试听 / 删除）；目前不做自动删除，这里是对用户的承诺下限 */
    public final int retentionDaysAfterExpiry;

    public UserMusicProperties(@Value("${app.user-music.max-file-bytes:31457280}") long maxFileBytes,
                               @Value("${app.user-music.max-tracks:20}") int maxTracks,
                               @Value("${app.user-music.max-total-bytes:524288000}") long maxTotalBytes,
                               @Value("${app.user-music.min-duration-seconds:3}") int minDurationSeconds,
                               @Value("${app.user-music.max-duration-seconds:1800}") int maxDurationSeconds,
                               @Value("${app.user-music.play-url-ttl-seconds:900}") long playUrlTtlSeconds,
                               @Value("${app.user-music.abandon-after-minutes:120}") int abandonAfterMinutes,
                               @Value("${app.user-music.retention-days-after-expiry:365}") int retentionDaysAfterExpiry) {
        this.maxFileBytes = maxFileBytes; this.maxTracks = maxTracks; this.maxTotalBytes = maxTotalBytes;
        this.minDurationSeconds = minDurationSeconds; this.maxDurationSeconds = maxDurationSeconds;
        this.playUrlTtlSeconds = playUrlTtlSeconds; this.abandonAfterMinutes = abandonAfterMinutes; this.retentionDaysAfterExpiry = retentionDaysAfterExpiry;
    }

    /** 测试用默认值 */
    public static UserMusicProperties defaults() { return new UserMusicProperties(31457280L, 20, 524288000L, 3, 1800, 900, 120, 365); }

    public int maxFileMb() { return (int) (maxFileBytes / (1024 * 1024)); }
}
