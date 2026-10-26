package com.tabitrace.checkin;

import com.tabitrace.checkin.dto.CheckinDtos.*;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.checkin.service.QuickCheckinService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.geo.dto.GeoDtos.WeatherSnapshot;
import com.tabitrace.geo.service.WeatherService;
import com.tabitrace.photo.dto.PhotoDtos.PhotoView;
import com.tabitrace.photo.dto.PhotoDtos.RegisterPhotoRequest;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 快速打卡：不写地点也能保存（记为「随手记录」）、照片默认不设精选、天气失败不影响保存、照片登记失败整体回滚 */
class QuickCheckinServiceTest {
    CheckinService checkins; CheckinMapper mapper; PhotoService photos; WeatherService weather; TripService trips; PlatformTransactionManager tx; QuickCheckinService service;
    final OffsetDateTime now = OffsetDateTime.parse("2026-10-02T14:32:00+09:00");

    @BeforeEach
    void setUp() {
        checkins = mock(CheckinService.class); mapper = mock(CheckinMapper.class); photos = mock(PhotoService.class);
        weather = mock(WeatherService.class); trips = mock(TripService.class); tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new QuickCheckinService(checkins, mapper, photos, weather, trips, tx);
        when(checkins.create(anyLong(), anyLong(), any())).thenReturn(new CheckinView(55L, 11L, null, null, "MANUAL", now, null, null, "x", null, null, now));
        when(checkins.get(anyLong(), eq(55L))).thenReturn(new CheckinView(55L, 11L, null, null, "MANUAL", now, null, null, "x", null, null, now));
        when(photos.register(anyLong(), anyLong(), any())).thenAnswer(inv -> {
            RegisterPhotoRequest r = inv.getArgument(2);
            return new PhotoView(9L, 11L, r.checkinId(), r.storageKey(), "u", null, null, 1L, r.mimeType(), Boolean.TRUE.equals(r.featured()), r.capturedAt(), now, null, null);
        });
    }

    private RegisterPhotoRequest photo() {
        return new RegisterPhotoRequest(null, "users/8/trips/11/a.jpg", null, 1200, 900, 1000L, "image/jpeg", false, null, null, null);
    }

    @Test
    void savesWithoutPlaceNoteOrLocation() {
        var req = new QuickCheckinRequest(new CreateCheckinRequest(null, null, now, null, null, null, null, null, "Asia/Tokyo", null), List.of(photo()), true);
        QuickCheckinResult r = service.create(8L, 11L, req);
        ArgumentCaptor<CreateCheckinRequest> c = ArgumentCaptor.forClass(CreateCheckinRequest.class);
        verify(checkins).create(eq(8L), eq(11L), c.capture());
        assertEquals(QuickCheckinService.UNKNOWN_PLACE, c.getValue().placeName(), "没有地点时记为「随手记录」，不猜测地点");
        assertNull(c.getValue().note(), "心情可以为空");
        assertEquals("Asia/Tokyo", c.getValue().timezone());
        verify(weather).at(isNull(), isNull(), any()); // 没有坐标时 WeatherService 自己返回 null
        assertEquals(1, r.photos().size());
        assertEquals(55L, r.photos().get(0).checkinId(), "照片关联到这次打卡");
        assertFalse(r.photos().get(0).featured(), "随手拍默认不设为精选");
        assertEquals(now, r.photos().get(0).capturedAt(), "照片时间默认用打卡时间");
        verify(mapper, never()).updateWeather(any());
        verify(tx).commit(any());
    }

    @Test
    void weatherSnapshotIsSavedWhenAvailable() {
        when(weather.at(any(), any(), any())).thenReturn(new WeatherSnapshot(0, "晴", new BigDecimal("22.0"), now.minusMinutes(5), "open-meteo"));
        var req = new QuickCheckinRequest(new CreateCheckinRequest(null, null, now, new BigDecimal("35.71"), new BigDecimal("139.79"), "浅草附近", "臺東區", "好天气", "Asia/Tokyo", 12), List.of(photo()), true);
        service.create(8L, 11L, req);
        ArgumentCaptor<CheckinEntity> e = ArgumentCaptor.forClass(CheckinEntity.class);
        verify(mapper).updateWeather(e.capture());
        assertEquals(55L, e.getValue().id);
        assertEquals("晴", e.getValue().weatherText);
        assertEquals(new BigDecimal("22.0"), e.getValue().temperatureC);
        ArgumentCaptor<CreateCheckinRequest> c = ArgumentCaptor.forClass(CreateCheckinRequest.class);
        verify(checkins).create(anyLong(), anyLong(), c.capture());
        assertEquals("浅草附近", c.getValue().placeName());
        assertEquals(12, c.getValue().accuracyM());
    }

    @Test
    void weatherFailureDoesNotBlockSaving() {
        when(weather.at(any(), any(), any())).thenReturn(null);
        var req = new QuickCheckinRequest(new CreateCheckinRequest(null, null, now, new BigDecimal("35.71"), new BigDecimal("139.79"), "浅草附近", null, null, null, null), List.of(photo()), true);
        assertNotNull(service.create(8L, 11L, req).checkin());
        verify(mapper, never()).updateWeather(any());
    }

    @Test
    void photoRegistrationFailureRollsBackTheWholeCheckin() {
        doThrow(new BusinessException("PHOTO_UPLOAD_MISSING", "请先完成图片上传")).when(photos).register(anyLong(), anyLong(), any());
        var req = new QuickCheckinRequest(new CreateCheckinRequest(null, null, now, null, null, "浅草附近", null, null, null, null), List.of(photo()), false);
        assertThrows(BusinessException.class, () -> service.create(8L, 11L, req));
        verify(tx).rollback(any());
        verify(tx, never()).commit(any());
    }
}
