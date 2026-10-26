package com.tabitrace.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * 轮询 QUEUED 任务并渲染。
 * 阶段与进度实时写库（不包事务，前端轮询能立刻看到）：PREPARING → STORY → MUSIC → EXPORTING → UPLOADING。
 * 处理期间定时刷新 updated_at 作为心跳；Worker 崩溃后心跳停止，API 的 VideoRenderWatchdog 会把任务标为「生成中断」。
 *
 * 停机（SIGTERM → Spring 关闭上下文）：
 * 1. 立即停止领取新任务；
 * 2. 正在渲染的任务最多再等 worker.shutdown-grace-seconds 秒；
 * 3. 仍未完成就中断渲染（FFmpeg 子进程一并结束、中间文件清理），把任务放回队列（QUEUED），
 *    由下一个 Worker 实例重新生成——渲染是幂等的（同一项目的成片路径固定，覆盖写入）。
 * 平台的停机等待时间（Railway drainingSeconds）需要大于 grace + 10 秒。
 */
@Component
public class VideoJobPoller {
    private static final Logger log = LoggerFactory.getLogger(VideoJobPoller.class);

    private final JdbcTemplate jdbc;
    private final FfmpegRenderer renderer;
    private final WorkerStorage storage;
    private final long heartbeatSeconds;
    private final long shutdownGraceSeconds;
    /** 只在轮询线程上读写：第一次拾取任务之前清扫上次异常退出的遗留文件 */
    private boolean swept;
    /** 收到停机信号后不再领取新任务 */
    private volatile boolean stopping;
    /** 停机宽限期已过：当前任务的任何失败都视为“被停机打断”，放回队列而不是标记失败 */
    private volatile boolean requeueCurrent;
    /** 正在渲染的线程（没有任务时为 null） */
    private volatile Thread working;
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "video-heartbeat");
        t.setDaemon(true);
        return t;
    });

    public VideoJobPoller(JdbcTemplate jdbc, FfmpegRenderer renderer, WorkerStorage storage,
                          @Value("${worker.heartbeat-seconds:15}") long heartbeatSeconds,
                          @Value("${worker.shutdown-grace-seconds:20}") long shutdownGraceSeconds) {
        this.jdbc = jdbc;
        this.renderer = renderer;
        this.storage = storage;
        this.heartbeatSeconds = heartbeatSeconds;
        this.shutdownGraceSeconds = shutdownGraceSeconds;
    }

    @Scheduled(fixedDelayString = "${worker.poll-ms:5000}")
    public void poll() {
        if (stopping) return;
        if (!swept) {
            swept = true;
            try {
                int removed = renderer.sweepLeftovers(!storage.remote());
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
        for (VideoJob j : jobs) if (!stopping) process(j);
    }

    public void process(VideoJob job) {
        int claimed = jdbc.update(
                "UPDATE video_projects SET status='PROCESSING',renderer='FFMPEG',render_stage='PREPARING',progress=5,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='QUEUED'",
                job.id());
        if (claimed == 0) return;
        working = Thread.currentThread();
        ScheduledFuture<?> beat = heartbeat.scheduleAtFixedRate(() -> touch(job), heartbeatSeconds, heartbeatSeconds, TimeUnit.SECONDS);
        try {
            // 生成成功但有降级时记下告警（目前只有 MUSIC_FALLBACK），完成时写入 render_warning
            java.util.concurrent.atomic.AtomicReference<String> warning = new java.util.concurrent.atomic.AtomicReference<>();
            Path file = renderer.render(job, new FfmpegRenderer.Progress() {
                @Override public void report(String stage, int progress) {
                    // 阶段之间检查停机中断（图像绘制等不响应中断的步骤在这里收尾）
                    if (requeueCurrent) throw new CancellationException("worker shutting down");
                    jdbc.update("UPDATE video_projects SET render_stage=?,progress=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                            stage, progress, job.id());
                }
                // 多个降级同时发生时用逗号连接（目前只有 MUSIC_FALLBACK）
                @Override public void warn(String code) { warning.updateAndGet(w -> w == null ? code : w.contains(code) ? w : w + "," + code); }
            });
            jdbc.update("UPDATE video_projects SET render_stage='UPLOADING',progress=95,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'", job.id());
            WorkerStorage.Result saved;
            try {
                saved = storage.save(job, file);
            } catch (Exception ex) {
                throw new RenderFailure("STORAGE_FAILED", "视频已合成，但保存到存储失败", ex);
            }
            int done = jdbc.update(
                    "UPDATE video_projects SET status='COMPLETED',progress=100,render_stage=NULL,output_key=?,output_url=?,error_code=NULL,error_message=NULL,render_warning=?,completed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                    saved.key(), saved.url(), warning.get(), job.id());
            if (done == 0) log.warn("视频项目 {} 渲染完成时已不在 PROCESSING 状态（可能已被判定超时），结果未写回", job.id());
            // 成片已在对象存储：本地文件立即删除
            if (storage.remote()) renderer.discard(job.id());
        } catch (Exception ex) {
            if (requeueCurrent) requeue(job, ex);
            else if (ex instanceof RenderFailure f) fail(job, f.code(), describe(f));
            else fail(job, "RENDER_FAILED", describe(ex));
        } finally {
            beat.cancel(false);
            Thread.interrupted(); // 清掉停机中断标记，不影响线程池
            working = null;
        }
    }

    /**
     * 停机：在 Spring 关闭调度器、连接池之前执行（ContextClosedEvent 先于 Bean 销毁发布），
     * 因此这里仍可以写数据库，把被打断的任务放回队列。
     */
    @EventListener(ContextClosedEvent.class)
    public void onShutdown() {
        stopping = true;
        if (working == null) { log.info("停机：没有正在渲染的视频，直接退出"); return; }
        log.info("停机：不再领取新任务，等待当前视频最多 {} 秒", shutdownGraceSeconds);
        if (waitIdle(TimeUnit.SECONDS.toMillis(shutdownGraceSeconds))) { log.info("停机：当前视频已完成"); return; }
        requeueCurrent = true;
        Thread t = working;
        if (t != null) t.interrupt();
        if (waitIdle(10_000)) log.info("停机：当前视频已中断并放回队列，由下一个 Worker 重新生成");
        else log.warn("停机：当前视频 10 秒内未能中断；心跳停止后 API 会把它标为「生成中断」");
    }

    private boolean waitIdle(long millis) {
        long deadline = System.currentTimeMillis() + millis;
        while (working != null && System.currentTimeMillis() < deadline) {
            try { Thread.sleep(100); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); return working == null; }
        }
        return working == null;
    }

    /** 被停机打断的任务：恢复成排队状态（进度清零），不记录为失败 */
    private void requeue(VideoJob job, Exception cause) {
        int n = jdbc.update(
                "UPDATE video_projects SET status='QUEUED',renderer=NULL,render_stage=NULL,progress=0,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'",
                job.id());
        log.info("视频项目 {} 因 Worker 停机中断（{}），{}", job.id(), cause.getClass().getSimpleName(), n == 1 ? "已放回队列" : "状态已变化，未放回队列");
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
