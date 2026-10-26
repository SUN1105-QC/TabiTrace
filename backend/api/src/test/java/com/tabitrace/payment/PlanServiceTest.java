package com.tabitrace.payment;

import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.payment.service.PlanService;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.video.entity.VideoMusicEntity;
import com.tabitrace.video.entity.VideoTemplateEntity;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.service.VideoService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 升级页读取的方案配置必须与真正执行的业务常量一致 */
class PlanServiceTest {
    static VideoTemplateEntity tpl(String name, String plan, boolean enabled) { VideoTemplateEntity t = new VideoTemplateEntity(); t.code = name; t.name = name; t.plan = plan; t.enabled = enabled; return t; }
    static VideoMusicEntity music(String code, String plan) { VideoMusicEntity m = new VideoMusicEntity(); m.code = code; m.name = code; m.plan = plan; m.enabled = true; m.status = "APPROVED"; m.objectKey = "music/originals/" + code + ".mp3"; return m; }

    @Test
    void planMirrorsEnforcedRules() {
        VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
        when(catalog.templates()).thenReturn(List.of(tpl("旅行日记", "FREE", true), tpl("城市节奏", "PRO", true), tpl("停用", "PRO", false)));
        VideoMusicEntity pending = music("CC0_PENDING", "FREE"); pending.status = "REVIEW_REQUIRED"; pending.objectKey = null;
        VideoMusicEntity retired = music("RETIRED", "PRO"); retired.enabled = false;
        when(catalog.music()).thenReturn(List.of(pending, music("WARM", "FREE"), music("NIGHT", "PRO"), retired));
        PaymentService payments = mock(PaymentService.class);
        when(payments.realPayments()).thenReturn(false);

        var p = new PlanService(catalog, payments).tripPro();
        assertEquals(PaymentService.TRIP_PRO_AMOUNT, p.price().amount());
        assertEquals("CNY", p.price().currency());
        assertEquals("ONE_TIME_PER_TRIP", p.billing());
        assertFalse(p.renews());
        assertFalse(p.expires());
        assertFalse(p.realPayments());
        assertEquals(TripService.FREE_ACTIVE_TRIP_LIMIT, p.freeLimits().activeFreeTrips());
        assertEquals(CheckinService.FREE_CHECKIN_LIMIT, p.freeLimits().checkinsPerTrip());
        assertEquals(PhotoService.FREE_PHOTO_LIMIT, p.freeLimits().photosPerTrip());
        assertEquals(VideoService.FREE_MAX_PHOTOS, p.storyFree().maxPhotos());
        assertEquals(List.of(15, 30, 60), p.storyPro().durations());
        assertTrue(p.storyFree().watermark());
        assertFalse(p.storyPro().watermark());
        // 分享图：Free 标准清晰度 + 水印；Pro 高清（海报 1440 宽、整张 2 倍、单张 1080）+ 无水印
        assertEquals("STANDARD", p.shareFree().quality());
        assertTrue(p.shareFree().watermark());
        assertEquals("HD", p.sharePro().quality());
        assertFalse(p.sharePro().watermark());
        assertTrue(p.sharePro().posterWidth() > p.shareFree().posterWidth());
        assertTrue(p.sharePro().scale() > p.shareFree().scale());
        assertTrue(p.sharePro().tileSize() > p.shareFree().tileSize());
        assertEquals(2, p.storyTemplates().size());   // 停用的模板不展示
        assertEquals(2, p.storyMusic().size());       // 待审核（音频未导入）与已下架的曲目不展示
    }
}
