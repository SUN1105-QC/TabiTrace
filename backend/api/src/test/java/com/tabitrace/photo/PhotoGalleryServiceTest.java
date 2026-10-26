package com.tabitrace.photo;

import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.dto.PhotoDtos.BatchPhotoRequest;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 照片工作台：删除时清理引用、设为封面、批量操作的归属校验 */
class PhotoGalleryServiceTest {
    PhotoMapper photos; TripMapper tripMapper; TripService trips; AchievementService achievements; PhotoService service; StorageService storage;

    @BeforeEach
    void setUp() {
        photos = mock(PhotoMapper.class); tripMapper = mock(TripMapper.class); trips = mock(TripService.class); achievements = mock(AchievementService.class);
        storage = mock(StorageService.class);
        service = new PhotoService(photos, trips, mock(CheckinMapper.class), storage, achievements, tripMapper);
        TripEntity t = new TripEntity(); t.id = 5L; t.userId = 1L; t.title = "t"; t.destinationName = "d"; t.startDate = LocalDate.of(2026, 10, 1); t.endDate = LocalDate.of(2026, 10, 3); t.planType = "FREE"; t.status = "ONGOING"; t.visibility = "PRIVATE";
        when(trips.requireWritable(1L, 5L)).thenReturn(t);
        when(tripMapper.findById(5L)).thenReturn(t);
        when(photos.findById(10L)).thenReturn(photo(10L, 5L));
        when(photos.findById(11L)).thenReturn(photo(11L, 5L));
        when(photos.findById(99L)).thenReturn(photo(99L, 6L));
    }

    static PhotoEntity photo(Long id, Long tripId) { PhotoEntity p = new PhotoEntity(); p.id = id; p.tripId = tripId; p.imageUrl = "u" + id; p.storageKey = "users/1/trips/" + tripId + "/" + id + ".jpg"; return p; }

    @Test
    void deleteRemovesTheStoredFileBeforeTheRecord() {
        service.delete(1L, 10L);
        var order = inOrder(storage, photos);
        order.verify(storage).deleteAll(List.of("users/1/trips/5/10.jpg"));
        order.verify(photos).delete(10L);
    }

    @Test
    void storageFailureKeepsTheRecord() {
        doThrow(new BusinessException("STORAGE_DELETE_FAILED", "x")).when(storage).deleteAll(anyCollection());
        assertThrows(BusinessException.class, () -> service.delete(1L, 10L));
        verify(photos, never()).delete(10L);
    }

    @Test
    void presignRejectsSvgAndMissingSize() {
        assertThrows(BusinessException.class, () -> service.presign(1L, 5L, new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("x.svg", "image/svg+xml", 100L)));
        assertThrows(BusinessException.class, () -> service.presign(1L, 5L, new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("x.jpg", "image/jpeg", null)));
        service.presign(1L, 5L, new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("x.jpg", "image/jpeg", 1000L));
        verify(storage).presign(1L, 5L, "x.jpg", "image/jpeg", 1000L);
    }

    @Test
    void deleteClearsCoverReferences() {
        service.delete(1L, 10L);
        verify(photos).delete(10L);
        verify(photos).clearVideoCover(10L);
        verify(tripMapper).clearCoverIf(5L, "u10");
        verify(achievements).evaluate(1L, 5L, "PHOTO_DELETED");
    }

    @Test
    void coverMustBelongToTrip() {
        service.setCover(1L, 5L, 10L);
        verify(tripMapper).updateCover(5L, "u10");
        assertThrows(BusinessException.class, () -> service.setCover(1L, 5L, 99L));
        verify(tripMapper, never()).updateCover(5L, "u99");
    }

    @Test
    void batchFeatureAndDelete() {
        assertEquals(2, service.batch(1L, 5L, new BatchPhotoRequest(List.of(10L, 11L, 10L), "feature")).affected());
        verify(photos).setFeatured(10L, true);
        verify(photos).setFeatured(11L, true);
        service.batch(1L, 5L, new BatchPhotoRequest(List.of(11L), "DELETE"));
        verify(photos).delete(11L);
        verify(tripMapper).clearCoverIf(5L, "u11");
    }

    @Test
    void batchRejectsForeignPhotosAndUnknownActions() {
        assertThrows(BusinessException.class, () -> service.batch(1L, 5L, new BatchPhotoRequest(List.of(10L, 99L), "DELETE")));
        verify(photos, never()).delete(anyLong());
        assertThrows(BusinessException.class, () -> service.batch(1L, 5L, new BatchPhotoRequest(List.of(10L), "DOWNLOAD")));
    }

    @Test
    void deleteRemovesThumbnailAndMediumTogetherAndClearsMediumCover() {
        PhotoEntity p = photo(12L, 5L); p.thumbKey = "users/1/trips/5/12-thumb.jpg"; p.mediumKey = "users/1/trips/5/12-medium.jpg"; p.mediumUrl = "m12";
        when(photos.findById(12L)).thenReturn(p);
        service.delete(1L, 12L);
        verify(storage).deleteAll(List.of("users/1/trips/5/12.jpg", "users/1/trips/5/12-thumb.jpg", "users/1/trips/5/12-medium.jpg"));
        verify(tripMapper).clearCoverIf(5L, "u12");
        verify(tripMapper).clearCoverIf(5L, "m12");
    }

    @Test
    void coverUsesMediumWhenAvailable() {
        PhotoEntity p = photo(13L, 5L); p.mediumUrl = "m13";
        when(photos.findById(13L)).thenReturn(p);
        service.setCover(1L, 5L, 13L);
        verify(tripMapper).updateCover(5L, "m13");
    }

    @Test
    void variantKeysAreDerivedFromTheOriginal() {
        var PR = com.tabitrace.photo.dto.PhotoDtos.PresignRequest.class;
        String original = "users/1/trips/5/abc.png";
        service.presign(1L, 5L, new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("thumb.jpg", "image/jpeg", 50_000L, original, "thumb"));
        verify(storage).presignKey("users/1/trips/5/abc-thumb.jpg", "image/jpeg", 50_000L);
        service.presign(1L, 5L, new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("m.jpg", "image/jpeg", 400_000L, original, "medium"));
        verify(storage).presignKey("users/1/trips/5/abc-medium.jpg", "image/jpeg", 400_000L);
        verify(storage, never()).presign(anyLong(), anyLong(), anyString(), anyString(), anyLong());
        assertNotNull(PR);
    }

    @Test
    void variantPresignRejectsForeignKeysOversizeAndBadTypes() {
        java.util.function.Function<com.tabitrace.photo.dto.PhotoDtos.PresignRequest, String> code = r -> assertThrows(BusinessException.class, () -> service.presign(1L, 5L, r)).getCode();
        assertEquals("INVALID_STORAGE_KEY", code.apply(new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("t.jpg", "image/jpeg", 1000L, "users/2/trips/5/abc.jpg", "thumb")));
        assertEquals("INVALID_STORAGE_KEY", code.apply(new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("t.jpg", "image/jpeg", 1000L, "users/1/trips/5/abc-thumb.jpg", "thumb")));
        assertEquals("PHOTO_TOO_LARGE", code.apply(new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("t.jpg", "image/jpeg", PhotoService.THUMB_MAX_BYTES + 1, "users/1/trips/5/abc.jpg", "thumb")));
        assertEquals("INVALID_PHOTO_TYPE", code.apply(new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("t.png", "image/png", 1000L, "users/1/trips/5/abc.jpg", "thumb")));
        assertEquals("INVALID_PHOTO_VARIANT", code.apply(new com.tabitrace.photo.dto.PhotoDtos.PresignRequest("t.jpg", "image/jpeg", 1000L, "users/1/trips/5/abc.jpg", "huge")));
    }

    @Test
    void registerRejectsVariantThatDoesNotBelongToTheOriginal() {
        when(storage.exists(anyString())).thenReturn(true);
        var r = new com.tabitrace.photo.dto.PhotoDtos.RegisterPhotoRequest(null, "users/1/trips/5/abc.jpg", null, 10, 10, 1000L, "image/jpeg", false, null, "users/1/trips/5/other-thumb.jpg", null);
        assertEquals("INVALID_STORAGE_KEY", assertThrows(BusinessException.class, () -> service.register(1L, 5L, r)).getCode());
        verify(photos, never()).insert(any());
    }
}
