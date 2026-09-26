package com.tabitrace.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * 轮询 QUEUED 任务并渲染。
 * 阶段与进度实时写库（不包事务，前端轮询能立刻看到）：PREPARING → MAP → STORY → MUSIC → EXPORTING → UPLOADING。
 * 处理期间定时刷新 updated_at 作为心跳；Worker 崩溃后心跳停止，API 的 VideoRenderWatchdog 会把任务标为「生成中断」。
 */
@Component
public class VideoJobPoller {
    private static final Logger log = LoggerFactory.getLogger(VideoJobPoller.class);

    private final JdbcTemplate jdbc;
    private final FfmpegRenderer renderer;
    private final WorkerStorage storage;
    private final long heartbeatSeconds;
    /** 只在轮询线程上读写：第一次拾取任务之前清扫上次异常退出的遗留文件 */
    private boolean swept;
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "video-heartbeat");
        t.setDaemon(true);
        return t;
    });

    public VideoJobPoller(JdbcTemplate jdbc, FfmpegRenderer renderer, WorkerStorage storage,
                          @Value("${worker.heartbeat-seconds:15}") long heartbeatSeconds) {
        this.jdbc = jdbc;
        this.renderer = renderer;
        this.storage = storage;
        this.heartbeatSeconds = heartbeatSeconds;
    }

    @Scheduled(fixedDelayString = "${worker.poll-ms:5000}")
    public void poll() {
        if (!swept) {
            swept = true;
            try {
                int removed = renderer.sweepLeftovers();
                if (removed > 0) log.warn("清理了上次异常退出遗留的 {} 个中间文件（下载的原始照片 / 画面帧）", removed);
            } catch (Exception ex) {
                log.warn("清理遗留中间文件失败：{}", ex.getMessage());
            }
        }
        List<VideoJob> jobs = jdbc.query(
                "SELECT v.*,t.plan_type FROM video_projects v JOIN trips t ON t.id=v.trip_id WHERE v.status='QUEUED' ORDER BY v.id LIMIT 1",
                (rs, n) -> new VideoJob(rs.getLong("id"), rs.getLong("user_id"), rs.getLong("trip_id"),
                        rs.getString("template_code"), rs.getString("aspect_ratio"), rs.getInt("duration"),
                        rs.getString("music_code"), rs.getString("quality"), rs.getString("plan_type"),
                        rs.getString("storyboard_json")));
        for (VideoJob j : jobs) process(j);
    }

    public void process(VideoJob job) {
        int claimed = jdbc.update(
                "UPDATE video_projects SET status='PROCESSING',renderer='FFMPEG',render_stage='PREPARING',progress=5,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='QUEUED'",
                job.id());
        if (claimed == 0) return;
        ScheduledFuture<?> beat = heartbeat.scheduleAtFixedRate(() -> touch(job), heartbeatSeconds, heartbeatSeconds, TimeUnit.SECONDS);
        try {
            Path file = renderer.render(job, (stage, progress) -> jdbc.update(
                    "UPDATE video_projects SET render_stage=?,progress=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                    stage, progress, job.id()));
            jdbc.update("UPDATE video_projects SET render_stage='UPLOADING',progress=95,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'", job.id());
            WorkerStorage.Result saved;
            try {
                saved = storage.save(job, file);
            } catch (Exception ex) {
                throw new RenderFailure("STORAGE_FAILED", "视频已合成，但保存到存储失败", ex);
            }
            int done = jdbc.update(
                    "UPDATE video_projects SET status='COMPLETED',progress=100,render_stage=NULL,output_key=?,output_url=?,error_code=NULL,error_message=NULL,completed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                    saved.key(), saved.url(), job.id());
            if (done == 0) log.warn("视频项目 {} 渲染完成时已不在 PROCESSING 状态（可能已被判定超时），结果未写回", job.id());
        } catch (RenderFailure f) {
            fail(job, f.code(), describe(f));
        } catch (Exception ex) {
            fail(job, "RENDER_FAILED", describe(ex));
        } finally {
            beat.cancel(false);
        }
    }

    /** 心跳：只刷新时间，不改状态；异常吞掉，避免定时任务因一次失败而停止。 */
    private void touch(VideoJob job) {
        try {
            jdbc.update("UPDATE video_projects SET updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'", job.id());
        } catch (Exception ex) {
            log.warn("视频项目 {} 心跳写入失败：{}", job.id(), ex.getMessage());
        }
    }

    private void fail(VideoJob job, String code, String message) {
        jdbc.update(
                "UPDATE video_projects SET status='FAILED',render_stage=NULL,error_code=?,error_message=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                code, message, job.id());
    }

    /** 用户可读的摘要在前，技术细节（截断）在后。 */
    private static String describe(Throwable t) {
        String head = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
        Throwable cause = t.getCause();
        String detail = cause == null || cause.getMessage() == null ? "" : "\n" + cause.getMessage();
        String msg = head + detail;
        return msg.length() > 1500 ? msg.substring(0, 1500) : msg;
    }
}
