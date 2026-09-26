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
    static VideoMusicEntity music(String code, String plan) { VideoMusicEntity m = new VideoMusicEntity(); m.code = code; m.name = code; m.plan = plan; m.enabled = true; return m; }

    @Test
    void planMirrorsEnforcedRules() {
        VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
        when(catalog.templates()).thenReturn(List.of(tpl("旅行日记", "FREE", true), tpl("城市节奏", "PRO", true), tpl("停用", "PRO", false)));
        when(catalog.music()).thenReturn(List.of(music("NONE", "FREE"), music("WARM", "FREE"), music("NIGHT", "PRO")));
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
        assertEquals(2, p.storyTemplates().size());   // 停用的模板不展示
        assertEquals(2, p.storyMusic().size());       // “无音乐”不算一首音乐
    }
}
