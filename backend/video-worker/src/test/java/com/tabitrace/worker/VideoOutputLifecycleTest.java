package com.tabitrace.worker;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class VideoOutputLifecycleTest {
    @TempDir Path root;
    JdbcTemplate jdbc;
    TransactionTemplate transactions;
    WorkerStorage storage;
    VideoOutputLifecycle outputs;
    final VideoJob job = new VideoJob(1L, 7L, 9L, "JOURNAL", "9:16", 30, null, "720p", "FREE", "{}");

    public static Timestamp utcTimestamp() { return Timestamp.from(Instant.now()); }

    @BeforeEach void setup() {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE ALIAS UTC_TIMESTAMP FOR 'com.tabitrace.worker.VideoOutputLifecycleTest.utcTimestamp'");
        jdbc.execute("""
                CREATE TABLE video_projects(id BIGINT PRIMARY KEY,status VARCHAR(30),progress INT,render_stage VARCHAR(30),
                  output_key VARCHAR(500),output_url VARCHAR(1000),output_bytes BIGINT,error_code VARCHAR(50),error_message VARCHAR(500),
                  render_warning VARCHAR(100),completed_at TIMESTAMP,updated_at TIMESTAMP)
                """);
        jdbc.execute("""
                CREATE TABLE video_output_deletions(project_id BIGINT PRIMARY KEY,user_id BIGINT,trip_id BIGINT,attempts INT DEFAULT 0,
                  next_attempt_at TIMESTAMP,last_error VARCHAR(100),created_at TIMESTAMP)
                """);
        var manager = new DataSourceTransactionManager(ds);
        transactions = new TransactionTemplate(manager);
        storage = mock(WorkerStorage.class);
        outputs = new VideoOutputLifecycle(jdbc, storage, manager, root.toString());
    }

    void project(String status) { jdbc.update("INSERT INTO video_projects(id,status) VALUES(1,?)", status); }
    // Explicitly overdue: H2's nanosecond clock can round a TIMESTAMP(6) slightly into the future.
    void task() { jdbc.update("INSERT INTO video_output_deletions(project_id,user_id,trip_id,next_attempt_at,created_at) VALUES(1,7,9,TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP()),UTC_TIMESTAMP())"); }
    Path output(long id) throws Exception {
        Path path = root.resolve("project-" + id).resolve("output.mp4");
        Files.createDirectories(path.getParent());
        Files.write(path, new byte[]{1, 2, 3, 4});
        return path;
    }
    int tasks() { return jdbc.queryForObject("SELECT COUNT(*) FROM video_output_deletions", Integer.class); }

    @Test void publishesMeasuredOutputWhileHoldingTransaction() throws Exception {
        project("PROCESSING"); Path file = output(1);
        when(storage.save(job, file)).thenAnswer(i -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            return new WorkerStorage.Result("users/7/trips/9/videos/1.mp4", "https://media.example/1.mp4");
        });
        assertTrue(outputs.publish(job, file, "MUSIC_FALLBACK"));
        assertEquals("COMPLETED", jdbc.queryForObject("SELECT status FROM video_projects WHERE id=1", String.class));
        assertEquals(4L, jdbc.queryForObject("SELECT output_bytes FROM video_projects WHERE id=1", Long.class));
        assertEquals("MUSIC_FALLBACK", jdbc.queryForObject("SELECT render_warning FROM video_projects WHERE id=1", String.class));
    }

    @Test void doesNotUploadDeletedOrInterruptedProject() throws Exception {
        Path file = output(1);
        assertFalse(outputs.publish(job, file, null));
        project("FAILED");
        assertFalse(outputs.publish(job, file, null));
        verifyNoInteractions(storage);
    }

    @Test void failedUploadRetainsProcessingStateAndStorageFailureCode() throws Exception {
        project("PROCESSING"); Path file = output(1);
        when(storage.save(job, file)).thenThrow(new IllegalStateException("simulated outage"));
        RenderFailure failure = assertThrows(RenderFailure.class, () -> outputs.publish(job, file, null));
        assertEquals("STORAGE_FAILED", failure.code());
        assertEquals("PROCESSING", jdbc.queryForObject("SELECT status FROM video_projects WHERE id=1", String.class));
        assertNull(jdbc.queryForObject("SELECT output_key FROM video_projects WHERE id=1", String.class));
    }

    @Test void cleanupDeletesOnlyItsOwnOutputAndIsIdempotent() throws Exception {
        task(); Path file = output(1); Path neighbor = output(10);
        Files.writeString(file.resolveSibling("frame.png"), "private intermediate");
        outputs.cleanup(); outputs.cleanup();
        assertFalse(Files.exists(file.getParent())); assertTrue(Files.exists(neighbor));
        verify(storage, times(1)).deleteOutput(7, 9, 1);
        assertEquals(0, tasks());
    }

    @Test void failedCleanupSurvivesAndWaitsBeforeRetry() throws Exception {
        task(); Path file = output(1);
        doThrow(new IllegalStateException("simulated outage")).when(storage).deleteOutput(7, 9, 1);
        outputs.cleanup(); outputs.cleanup();
        assertTrue(Files.exists(file)); assertEquals(1, tasks());
        assertEquals(1, jdbc.queryForObject("SELECT attempts FROM video_output_deletions", Integer.class));
        verify(storage, times(1)).deleteOutput(7, 9, 1);
        assertTrue(jdbc.queryForObject("SELECT next_attempt_at>UTC_TIMESTAMP() FROM video_output_deletions", Boolean.class));
        reset(storage);
        jdbc.update("UPDATE video_output_deletions SET next_attempt_at=TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP())");
        outputs.cleanup();
        assertFalse(Files.exists(file)); assertEquals(0, tasks());
    }

    @Test void neverDeletesFilesForAnExistingProject() throws Exception {
        project("COMPLETED"); task(); Path file = output(1);
        outputs.cleanup();
        assertTrue(Files.exists(file)); assertEquals(1, tasks());
        verifyNoInteractions(storage);
    }

    @Test void rolledBackDeletionCannotTriggerFileCleanup() throws Exception {
        Path file = output(1);
        transactions.executeWithoutResult(status -> { task(); status.setRollbackOnly(); });
        outputs.cleanup();
        assertTrue(Files.exists(file)); assertEquals(0, tasks()); verifyNoInteractions(storage);
    }

    @Test void publicationAndConcurrentDeletionSerializeBeforeCleanup() throws Exception {
        project("PROCESSING"); Path file = output(1);
        CountDownLatch saving = new CountDownLatch(1), release = new CountDownLatch(1), deleting = new CountDownLatch(1);
        when(storage.save(job, file)).thenAnswer(i -> {
            saving.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS));
            return new WorkerStorage.Result("users/7/trips/9/videos/1.mp4", "https://media.example/1.mp4");
        });
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Boolean> publish = pool.submit(() -> outputs.publish(job, file, null));
            try {
                assertTrue(saving.await(5, TimeUnit.SECONDS));
                Future<?> delete = pool.submit(() -> transactions.executeWithoutResult(status -> {
                    deleting.countDown();
                    jdbc.queryForList("SELECT id FROM video_projects WHERE id=1 FOR UPDATE", Long.class);
                    task(); jdbc.update("DELETE FROM video_projects WHERE id=1");
                }));
                assertTrue(deleting.await(5, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> delete.get(200, TimeUnit.MILLISECONDS));
                release.countDown(); assertTrue(publish.get(5, TimeUnit.SECONDS)); delete.get(5, TimeUnit.SECONDS);
                outputs.cleanup();
                assertEquals(0, tasks()); assertFalse(Files.exists(file));
                verify(storage).deleteOutput(7, 9, 1);
            } finally { release.countDown(); }
        }
    }

    @Test void cleanupSkipsTaskLockedByAnotherWorker() throws Exception {
        task(); Path file = output(1);
        CountDownLatch locked = new CountDownLatch(1), release = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newSingleThreadExecutor()) {
            Future<?> other = pool.submit(() -> transactions.executeWithoutResult(status -> {
                jdbc.queryForList("SELECT project_id FROM video_output_deletions WHERE project_id=1 FOR UPDATE", Long.class);
                locked.countDown();
                try { assertTrue(release.await(5, TimeUnit.SECONDS)); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new RuntimeException(ex); }
            }));
            try {
                assertTrue(locked.await(5, TimeUnit.SECONDS)); outputs.cleanup();
                assertTrue(Files.exists(file)); verifyNoInteractions(storage);
            } finally { release.countDown(); }
            other.get(5, TimeUnit.SECONDS);
        }
        outputs.cleanup(); assertEquals(0, tasks());
    }
}
