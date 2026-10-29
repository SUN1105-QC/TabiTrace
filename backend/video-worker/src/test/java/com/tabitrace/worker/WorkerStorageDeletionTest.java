package com.tabitrace.worker;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkerStorageDeletionTest {
    @Test void springCanWireStoragePublisherAndPoller() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.registerBean(JdbcTemplate.class, () -> mock(JdbcTemplate.class));
            context.registerBean(PlatformTransactionManager.class, () -> mock(PlatformTransactionManager.class));
            context.registerBean(FfmpegRenderer.class, () -> mock(FfmpegRenderer.class));
            context.register(WorkerStorage.class, VideoOutputLifecycle.class, VideoJobPoller.class);
            context.refresh();
            assertNotNull(context.getBean(VideoJobPoller.class));
            assertNotNull(context.getBean(VideoOutputLifecycle.class));
        }
    }

    @Test void deletesOnlyExactServerDerivedObjectInConfiguredBucket() {
        S3Client s3 = mock(S3Client.class);
        new WorkerStorage(s3, "video-bucket").deleteOutput(7, 9, 1);
        var request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3).deleteObject(request.capture());
        assertEquals("video-bucket", request.getValue().bucket());
        assertEquals("users/7/trips/9/videos/1.mp4", request.getValue().key());
        verifyNoMoreInteractions(s3);
    }

    @Test void invalidOwnershipNeverReachesObjectStorageAndFailuresPropagateForRetry() {
        S3Client s3 = mock(S3Client.class);
        WorkerStorage storage = new WorkerStorage(s3, "video-bucket");
        assertThrows(IllegalArgumentException.class, () -> storage.deleteOutput(0, 9, 1));
        assertThrows(IllegalArgumentException.class, () -> storage.deleteOutput(7, -1, 1));
        assertThrows(IllegalArgumentException.class, () -> storage.deleteOutput(7, 9, -1));
        verifyNoInteractions(s3);
        when(s3.deleteObject(any(DeleteObjectRequest.class))).thenThrow(new IllegalStateException("simulated outage"));
        assertThrows(IllegalStateException.class, () -> storage.deleteOutput(7, 9, 1));
    }
}
