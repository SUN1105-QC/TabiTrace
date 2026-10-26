package com.tabitrace.video;

import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.video.dto.VideoDtos.VideoMusicView;
import com.tabitrace.video.entity.VideoMusicEntity;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import com.tabitrace.video.service.VideoService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** 曲库：只下发可用曲目（启用 + 授权已核验 + 音频已导入），按分类 / 推荐模板 / FREE 过滤，不暴露原曲存储路径 */
class VideoMusicCatalogTest {
    static VideoMusicEntity track(String code, String category, String plan, String templates) {
        VideoMusicEntity m = new VideoMusicEntity();
        m.code = code; m.name = code; m.category = category; m.plan = plan; m.recommendedTemplates = templates;
        m.enabled = true; m.status = "APPROVED"; m.objectKey = "music/originals/" + code + ".mp3"; m.previewKey = "music/previews/" + code + ".mp3";
        m.mood = "warm,acoustic"; m.energy = "MEDIUM"; m.durationSeconds = new BigDecimal("168.2");
        m.license = "CC BY 4.0"; m.licenseUrl = "https://creativecommons.org/licenses/by/4.0/"; m.attributionRequired = true;
        m.attributionText = "'" + code + "' by Someone - CC-BY 4.0"; m.commercialUse = true; m.derivativesAllowed = true;
        return m;
    }

    private VideoService service(List<VideoMusicEntity> rows) {
        VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
        when(catalog.music()).thenReturn(rows);
        StorageService storage = mock(StorageService.class);
        when(storage.publicUrl(anyString())).thenAnswer(i -> "https://cdn.example/" + i.getArgument(0));
        return new VideoService(null, null, null, null, catalog, null, null, storage);
    }

    @Test void onlyUsableTracksAreListed() {
        VideoMusicEntity retired = track("RETIRED", "WARM", "FREE", "JOURNAL"); retired.enabled = false;
        VideoMusicEntity review = track("PIXABAY", "WARM", "FREE", "JOURNAL"); review.status = "REVIEW_REQUIRED";
        VideoMusicEntity notImported = track("CC0_PENDING", "LOFI", "FREE", "CITY"); notImported.objectKey = null;
        List<VideoMusicView> list = service(List.of(track("WARM_1", "WARM", "FREE", "JOURNAL"), retired, review, notImported)).music();
        assertEquals(List.of("WARM_1"), list.stream().map(VideoMusicView::code).toList(), "下架 / 待审核 / 音频未导入都不出现");
    }

    @Test void filtersByCategoryTemplateAndFreeOnly() {
        VideoService s = service(List.of(
                track("W1", "WARM", "FREE", "JOURNAL"), track("W2", "WARM", "PRO", "JOURNAL,MINIMAL"),
                track("C1", "CITY_NIGHT", "FREE", "CITY"), track("L1", "LOFI", "PRO", "JOURNAL,CITY")));
        assertEquals(List.of("W1", "W2"), s.music("warm", null, false).stream().map(VideoMusicView::code).toList());
        assertEquals(List.of("C1", "L1"), s.music(null, "city", false).stream().map(VideoMusicView::code).toList());
        assertEquals(List.of("W1", "C1"), s.music(null, null, true).stream().map(VideoMusicView::code).toList());
        assertEquals(List.of("W2"), s.music(null, "MINIMAL", false).stream().map(VideoMusicView::code).toList());
    }

    @Test void viewCarriesLicenseButNotStorageKey() {
        VideoMusicView v = service(List.of(track("W1", "WARM", "FREE", "JOURNAL,MINIMAL"))).music().get(0);
        assertEquals(List.of("JOURNAL", "MINIMAL"), v.recommendedTemplates());
        assertEquals("CC BY 4.0", v.license());
        assertTrue(v.attributionRequired());
        assertTrue(v.derivativesAllowed());
        assertEquals("MEDIUM", v.energy());
        assertEquals("https://cdn.example/music/previews/W1.mp3", v.previewUrl(), "只给 45 秒试听片段");
        assertFalse(v.toString().contains("music/originals/"), "原曲存储路径不能下发到浏览器");
    }
}
