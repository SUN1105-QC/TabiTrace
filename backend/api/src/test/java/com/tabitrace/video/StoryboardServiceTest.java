package com.tabitrace.video;

import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.summary.dto.SummaryDtos.TripSummary;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.entity.VideoTemplateEntity;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.service.StoryboardService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class StoryboardServiceTest {

    @Test
    void scenesAlwaysAddUpToTheChosenDuration() {
        for (int duration : List.of(15, 30, 60)) {
            StoryboardView sb = service(checkins(true, true, true)).build(1L, trip("FREE"), journal(), duration, "720p", "9:16",
                    null, StoryboardService.normalize(null, true, true, true), List.of(101L, 102L, 201L, 301L));
            double total = sb.scenes().stream().filter(SceneView::enabled).mapToDouble(SceneView::duration).sum();
            assertEquals(duration, total, 0.02, "总时长必须等于 " + duration + " 秒");
            assertEquals("OPENING", sb.scenes().get(0).type());
            assertEquals("ENDING", sb.scenes().get(sb.scenes().size() - 1).type());
        }
    }

    @Test
    void visualStyleIsNormalizedAndCarriedIntoTheStoryboard() {
        StorySettings film = new StorySettings(null, null, true, true, true, true, true, true, true, true, "SIMPLE", List.of(), " film ");
        StoryboardView sb = service(checkins(true, true, true)).build(1L, trip("FREE"), journal(), 30, "720p", "9:16",
                null, StoryboardService.normalize(film, null, null, null), List.of(101L, 201L, 301L));
        assertEquals("FILM", sb.grade());

        StorySettings unknown = new StorySettings(null, null, true, true, true, true, true, true, true, true, "SIMPLE", List.of(), "NEON");
        assertEquals("NATURAL", StoryboardService.normalize(unknown, null, null, null).visualStyle());
        assertEquals("NATURAL", StoryboardService.normalize(null, true, true, true).visualStyle());
    }

    @Test
    void mapFollowsCheckinTimeAndSkipsPlacesWithoutCoordinates() {
        StoryboardView sb = service(checkins(true, false, true)).build(1L, trip("FREE"), journal(), 30, "720p", "9:16",
                null, StoryboardService.normalize(null, true, true, true), List.of(101L, 201L, 301L));
        SceneView map = sb.scenes().stream().filter(s -> "MAP".equals(s.type())).findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> points = (List<java.util.Map<String, Object>>) map.meta().get("points");
        assertEquals(List.of("浅草寺", "东京塔"), points.stream().map(p -> p.get("name")).toList());
        assertTrue(sb.notices().stream().anyMatch(n -> n.contains("没有坐标")));
    }

    @Test
    void mapIsSkippedInsteadOfFailingWhenFewerThanTwoPointsHaveCoordinates() {
        StoryboardView sb = service(checkins(true, false, false)).build(1L, trip("FREE"), journal(), 30, "720p", "9:16",
                null, StoryboardService.normalize(null, true, true, true), List.of(101L, 201L));
        assertTrue(sb.scenes().stream().noneMatch(s -> "MAP".equals(s.type())));
        assertTrue(StoryboardService.hasPhotoScene(sb));
    }

    @Test
    void segmentOverridesReorderDisableAndRename() {
        StorySettings settings = new StorySettings(null, "东京，下次再见。", true, true, true, true, false, true, false, true, "OFF",
                List.of(new SegmentOverride("place-3", true, "夜里的东京塔"), new SegmentOverride("place-1", false, null),
                        new SegmentOverride("opening", null, "我的东京")), null);
        StoryboardView sb = service(checkins(true, true, true)).build(1L, trip("FREE"), journal(), 30, "720p", "9:16",
                null, StoryboardService.normalize(settings, null, null, null), List.of(101L, 201L, 301L));
        List<String> keys = sb.scenes().stream().map(SceneView::key).toList();
        assertEquals(List.of("opening", "place-3", "place-1", "place-2", "ending"), keys);
        assertEquals("我的东京", sb.scenes().get(0).title());
        assertEquals("夜里的东京塔", sb.scenes().get(1).title());
        SceneView disabled = sb.scenes().get(2);
        assertFalse(disabled.enabled());
        assertEquals(0, disabled.duration());
        assertEquals("东京，下次再见。", sb.scenes().get(4).meta().get("endingText"));
    }

    @Test
    void freeTripsGetWatermarkAnd720pResolution() {
        StoryboardView free = service(checkins(true, true, true)).build(1L, trip("FREE"), journal(), 30, "720p", "9:16",
                null, StoryboardService.normalize(null, true, true, true), List.of(101L));
        StoryboardView pro = service(checkins(true, true, true)).build(1L, trip("PRO"), journal(), 30, "1080p", "9:16",
                null, StoryboardService.normalize(null, true, true, true), List.of(101L));
        assertTrue(free.watermark());
        assertEquals("720×1280", free.resolution());
        assertFalse(pro.watermark());
        assertEquals("1080×1920", pro.resolution());
    }

    // ───────── 测试数据：三个打卡（浅草寺 → 上野公园 → 东京塔），每个打卡一张或两张照片 ─────────

    private static StoryboardService service(List<CheckinEntity> checkins) {
        CheckinMapper cm = mock(CheckinMapper.class);
        when(cm.listByTrip(anyLong())).thenReturn(checkins);
        PhotoMapper pm = mock(PhotoMapper.class);
        for (long id : List.of(101L, 102L, 201L, 301L)) when(pm.findById(id)).thenReturn(photo(id, id / 100));
        VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
        when(catalog.earnedAchievementNames(anyLong(), anyLong())).thenReturn(List.of("初次打卡"));
        SummaryService summaries = mock(SummaryService.class);
        when(summaries.get(anyLong(), anyLong())).thenReturn(new TripSummary(10L, "东京旅行", "ONGOING", "FREE", 6, 3, 4, 1, 3, 0, 0, 0, 1, List.of(), null));
        return new StoryboardService(cm, pm, catalog, summaries, mock(UserMapper.class));
    }

    private static List<CheckinEntity> checkins(boolean first, boolean second, boolean third) {
        return List.of(checkin(1, "浅草寺", first ? 35.7148 : null, 139.7967, 1),
                checkin(2, "上野公园", second ? 35.7156 : null, 139.7745, 2),
                checkin(3, "东京塔", third ? 35.6586 : null, 139.7454, 3));
    }

    private static CheckinEntity checkin(long id, String name, Double lat, double lng, int day) {
        CheckinEntity c = new CheckinEntity();
        c.id = id;
        c.placeNameSnapshot = name;
        c.latitude = lat == null ? null : BigDecimal.valueOf(lat);
        c.longitude = lat == null ? null : BigDecimal.valueOf(lng);
        c.checkinTime = LocalDateTime.of(2026, 10, day, 3, 0);
        c.note = name + "的一句话";
        return c;
    }

    private static PhotoEntity photo(long id, long checkinId) {
        PhotoEntity p = new PhotoEntity();
        p.id = id;
        p.tripId = 10L;
        p.checkinId = checkinId;
        p.createdAt = LocalDateTime.of(2026, 10, 1, 0, 0);
        return p;
    }

    private static TripEntity trip(String plan) {
        TripEntity t = new TripEntity();
        t.id = 10L;
        t.userId = 1L;
        t.title = "东京旅行";
        t.destinationName = "东京";
        t.city = "东京";
        t.startDate = LocalDate.of(2026, 10, 1);
        t.endDate = LocalDate.of(2026, 10, 6);
        t.planType = plan;
        return t;
    }

    private static VideoTemplateEntity journal() {
        VideoTemplateEntity t = new VideoTemplateEntity();
        t.code = "JOURNAL";
        t.pace = "SLOW";
        t.transition = "fade";
        t.transitionSeconds = BigDecimal.valueOf(0.6);
        return t;
    }
}
