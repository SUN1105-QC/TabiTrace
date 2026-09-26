package com.tabitrace.video.service;

import com.tabitrace.video.mapper.VideoProjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 回收「卡死」的视频任务。
 * Worker 处理期间每 15 秒刷新一次 updated_at；Worker 崩溃、被 systemd 重启或机器休眠后心跳停止，
 * 新的 Worker 只会拾取 QUEUED 任务，原来那条 PROCESSING 会永远转圈。
 * 这里放在 API（而不是 Worker）里运行，正是因为出问题时 Worker 可能根本不在。
 * 超时的任务标为 FAILED / RENDER_INTERRUPTED，用户点「重试」即可重新排队。
 */
@Component
public class VideoRenderWatchdog {
    private static final Logger log = LoggerFactory.getLogger(VideoRenderWatchdog.class);
    static final String MESSAGE = "生成过程中断：视频渲染服务长时间没有响应（可能已重启或崩溃）。请点「重试」重新生成。";

    private final VideoProjectMapper mapper;
    private final int timeoutSeconds;

    public VideoRenderWatchdog(VideoProjectMapper mapper,
                               @Value("${app.video.processing-timeout-seconds:300}") int timeoutSeconds) {
        this.mapper = mapper;
        this.timeoutSeconds = timeoutSeconds;
    }

    @Scheduled(fixedDelayString = "${app.video.watchdog-interval-ms:60000}", initialDelayString = "${app.video.watchdog-interval-ms:60000}")
    public void reap() {
        int n = mapper.failStale(timeoutSeconds, MESSAGE);
        if (n > 0) log.warn("{} 个视频任务超过 {} 秒没有心跳，已标记为生成中断", n, timeoutSeconds);
    }
}
