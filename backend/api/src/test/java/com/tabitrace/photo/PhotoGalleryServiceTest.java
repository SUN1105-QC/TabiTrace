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
    PhotoMapper photos; TripMapper tripMapper; TripService trips; AchievementService achievements; PhotoService service;

    @BeforeEach
    void setUp() {
        photos = mock(PhotoMapper.class); tripMapper = mock(TripMapper.class); trips = mock(TripService.class); achievements = mock(AchievementService.class);
        service = new PhotoService(photos, trips, mock(CheckinMapper.class), mock(StorageService.class), achievements, tripMapper);
        TripEntity t = new TripEntity(); t.id = 5L; t.userId = 1L; t.title = "t"; t.destinationName = "d"; t.startDate = LocalDate.of(2026, 10, 1); t.endDate = LocalDate.of(2026, 10, 3); t.planType = "FREE"; t.status = "ONGOING"; t.visibility = "PRIVATE";
        when(trips.requireWritable(1L, 5L)).thenReturn(t);
        when(tripMapper.findById(5L)).thenReturn(t);
        when(photos.findById(10L)).thenReturn(photo(10L, 5L));
        when(photos.findById(11L)).thenReturn(photo(11L, 5L));
        when(photos.findById(99L)).thenReturn(photo(99L, 6L));
    }

    static PhotoEntity photo(Long id, Long tripId) { PhotoEntity p = new PhotoEntity(); p.id = id; p.tripId = tripId; p.imageUrl = "u" + id; return p; }

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
}
