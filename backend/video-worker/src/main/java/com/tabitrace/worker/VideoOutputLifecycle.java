package com.tabitrace.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.Comparator;

/** 成片发布与持久化清理通过项目行锁协调，避免项目删除后又被渲染结果重新发布。 */
@Component
public class VideoOutputLifecycle {
    private static final Logger log = LoggerFactory.getLogger(VideoOutputLifecycle.class);
    private final JdbcTemplate jdbc;
    private final WorkerStorage storage;
    private final TransactionTemplate transactions;
    private final Path workDir;

    public VideoOutputLifecycle(JdbcTemplate jdbc, WorkerStorage storage, PlatformTransactionManager manager,
                                @Value("${worker.work-dir:./video-output}") String workDir) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.transactions = new TransactionTemplate(manager);
        this.workDir = Path.of(workDir).toAbsolutePath().normalize();
    }

    /** 发布先拿锁则删除等待；删除先完成则拒绝发布，不把已删除项目的成片重新暴露。 */
    public boolean publish(VideoJob job, Path file, String warning) throws IOException, RenderFailure {
        long bytes = Files.size(file);
        try {
            return Boolean.TRUE.equals(transactions.execute(status -> {
                var states = jdbc.queryForList("SELECT status FROM video_projects WHERE id=? FOR UPDATE", String.class, job.id());
                if (states.isEmpty() || !"PROCESSING".equals(states.getFirst())) return false;
                WorkerStorage.Result saved;
                try {
                    saved = storage.save(job, file);
                } catch (RuntimeException ex) {
                    throw new StoragePublishException(ex);
                }
                jdbc.update("""
                        UPDATE video_projects SET status='COMPLETED',progress=100,render_stage=NULL,
                          output_key=?,output_url=?,output_bytes=?,error_code=NULL,error_message=NULL,render_warning=?,
                          completed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PROCESSING'
                        """, saved.key(), saved.url(), bytes, warning, job.id());
                return true;
            }));
        } catch (StoragePublishException ex) {
            throw new RenderFailure("STORAGE_FAILED", "视频已合成，但保存到存储失败", ex.getCause());
        }
    }

    private static class StoragePublishException extends RuntimeException {
        StoragePublishException(RuntimeException cause) { super(cause); }
    }

    /** 清理独立调度：即使当前没有视频入队，历史待删除成片也会持续尝试清理。 */
    @Scheduled(fixedDelayString = "${worker.cleanup-interval-ms:60000}", initialDelayString = "${worker.cleanup-interval-ms:60000}")
    public void cleanup() {
        var ids = jdbc.queryForList("""
                SELECT project_id FROM video_output_deletions WHERE next_attempt_at<=UTC_TIMESTAMP()
                ORDER BY next_attempt_at,project_id LIMIT 20
                """, Long.class);
        for (Long id : ids) {
            try {
                cleanupOne(id);
            } catch (RuntimeException ex) {
                // 只记录异常类型，避免把签名 URL 或带凭证的异常消息持久化到清理队列。
                jdbc.update("""
                        UPDATE video_output_deletions SET attempts=LEAST(attempts+1,2147483647),last_error=?,
                          next_attempt_at=TIMESTAMPADD(SECOND,300,UTC_TIMESTAMP()) WHERE project_id=?
                        """, ex.getClass().getSimpleName(), id);
                log.warn("VIDEO cleanup failed projectId={} reason={}; retained for retry", id, ex.getClass().getSimpleName());
            }
        }
    }

    void cleanupOne(long id) {
        transactions.executeWithoutResult(status -> {
            var tasks = jdbc.query("""
                    SELECT user_id,trip_id FROM video_output_deletions
                    WHERE project_id=? AND next_attempt_at<=UTC_TIMESTAMP() FOR UPDATE SKIP LOCKED
                    """, (rs, n) -> new long[]{rs.getLong(1), rs.getLong(2)}, id);
            if (tasks.isEmpty()) return;
            if (!jdbc.queryForList("SELECT id FROM video_projects WHERE id=? FOR UPDATE", Long.class, id).isEmpty())
                throw new IllegalStateException("Cleanup requested for an existing project");
            long[] owner = tasks.getFirst();
            storage.deleteOutput(owner[0], owner[1], id);
            deleteLocalOutput(id);
            jdbc.update("DELETE FROM video_output_deletions WHERE project_id=?", id);
        });
    }

    private void deleteLocalOutput(long id) {
        if (id <= 0) throw new IllegalArgumentException("Invalid project ID");
        Path directory = workDir.resolve("project-" + id).normalize();
        if (!directory.startsWith(workDir) || directory.equals(workDir)) throw new IllegalArgumentException("Invalid output directory");
        if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) return;
        // 项目目录若被替换为符号链接，不能让递归清理转向其他目录。
        if (Files.isSymbolicLink(directory)) throw new IllegalStateException("Refusing symbolic output directory");
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
