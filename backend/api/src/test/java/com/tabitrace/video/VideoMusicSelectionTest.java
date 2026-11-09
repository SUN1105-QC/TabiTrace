package com.tabitrace.video;

import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.usermusic.entity.UserMusicEntity;
import com.tabitrace.usermusic.service.UserMusicService;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.entity.*;
import com.tabitrace.video.mapper.*;
import com.tabitrace.video.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VideoMusicSelectionTest {
    VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
    VideoProjectMapper projects = mock(VideoProjectMapper.class);
    VideoProjectPhotoMapper projectPhotos = mock(VideoProjectPhotoMapper.class);
    PhotoMapper photos = mock(PhotoMapper.class);
    TripService trips = mock(TripService.class);
    UserMusicService mine = mock(UserMusicService.class);
    StoryboardService storyboards = mock(StoryboardService.class);
    ObjectMapper json = new ObjectMapper();
    Map<Long, VideoProjectEntity> rows = new HashMap<>();
    VideoService service;

    @BeforeEach void setup() {
        TripEntity trip = new TripEntity(); trip.id = 2L; trip.userId = 1L; trip.title = "test"; trip.planType = "FREE";
        when(trips.requireWritable(1L, 2L)).thenReturn(trip);
        when(trips.requireOwned(1L, 2L)).thenReturn(trip);
        VideoTemplateEntity template = new VideoTemplateEntity(); template.code = "JOURNAL"; template.plan = "FREE";
        template.enabled = true; template.recommendedMusic = "LEGACY"; template.transitionSeconds = BigDecimal.ONE;
        when(catalog.template("JOURNAL")).thenReturn(template);
        when(catalog.templates()).thenReturn(List.of(template));
        PhotoEntity photo = new PhotoEntity(); photo.id = 3L; photo.tripId = 2L;
        when(photos.findById(3L)).thenReturn(photo);
        when(projectPhotos.photoIds(anyLong())).thenReturn(List.of(3L));
        when(projects.insert(any())).thenAnswer(i -> { VideoProjectEntity p = i.getArgument(0); p.id = 10L + rows.size(); rows.put(p.id, p); return 1; });
        when(projects.findById(anyLong())).thenAnswer(i -> rows.get(i.getArgument(0)));
        when(projects.queue(any())).thenReturn(1);
        service = new VideoService(projects, projectPhotos, photos, trips, catalog, storyboards, json, null, mine);
    }

    private UpsertVideoProjectRequest request(String source, String code, Long userMusicId) {
        return new UpsertVideoProjectRequest("JOURNAL", "9:16", 15, code, "720p", null, true, false, null, List.of(3L), source, userMusicId);
    }

    @Test void retiredCatalogAndTemplateRecommendationsStayEmpty() {
        assertTrue(service.music().isEmpty());
        assertTrue(service.music("WARM", "JOURNAL", true).isEmpty());
        assertNull(service.templates().getFirst().recommendedMusic());
        verify(catalog, never()).music();
    }

    @Test void explicitAndLegacySystemSelectionsCannotCreateProjects() {
        for (var r : List.of(request("SYSTEM", "LEGACY", null), request(null, "LEGACY", null), request("system", null, 9L))) {
            var error = assertThrows(BusinessException.class, () -> service.create(1L, 2L, r));
            assertEquals("VIDEO_SYSTEM_MUSIC_REMOVED", error.getCode());
        }
        verify(projects, never()).insert(any());
        verifyNoInteractions(mine);
    }

    @Test void noMusicRemainsUsableWithoutMembership() {
        for (var r : List.of(request(null, null, null), request("NONE", "LEGACY", null), request(null, "NONE", null))) {
            var result = service.create(1L, 2L, r);
            assertNull(result.musicSource()); assertNull(result.musicCode()); assertNull(result.userMusicId());
        }
        verifyNoInteractions(mine);
    }

    @Test void uploadedMusicIsValidatedAndFrozenForTheWorker() {
        UserMusicEntity music = new UserMusicEntity(); music.id = 9L; music.title = "mine";
        music.storageKey = "user-music/1/own.mp3"; music.durationSeconds = new BigDecimal("8");
        when(mine.requireUsable(1L, 9L)).thenReturn(music);
        var saved = service.create(1L, 2L, request("USER", null, 9L));
        assertEquals("USER", saved.musicSource()); assertEquals(9L, saved.userMusicId()); assertNull(saved.musicCode());
        var scene = new SceneView("photo", "PLACE", "photo", null, 0, 15, List.of(3L), true, false, Map.of());
        when(storyboards.build(eq(1L), any(), any(), eq(15), eq("720p"), eq("9:16"), isNull(), any(), eq(List.of(3L))))
                .thenReturn(new StoryboardView(15, "JOURNAL", "720x1280", true, "fade", 1, List.of(scene), List.of(), "NATURAL"));
        service.render(1L, saved.id());
        var cue = json.readTree(rows.get(saved.id()).storyboardJson).path("music");
        assertEquals("USER", cue.path("source").asText());
        assertEquals(9L, cue.path("userMusicId").asLong());
        assertEquals(music.storageKey, cue.path("objectKey").asText());
        assertTrue(cue.path("loudnorm").asBoolean()); assertTrue(cue.path("loop").asBoolean());
        verify(mine, times(2)).requireUsable(1L, 9L);
    }

    @Test void membershipOwnershipAndStatusRejectionsStillBlockSaving() {
        // Re-stub without invoking a previously configured rejection.
        for (String code : List.of("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", "USER_MUSIC_NOT_FOUND", "VIDEO_USER_MUSIC_DELETED")) {
            doThrow(new BusinessException(code, "unavailable")).when(mine).requireUsable(1L, 9L);
            assertEquals(code, assertThrows(BusinessException.class, () -> service.create(1L, 2L, request("USER", null, 9L))).getCode());
        }
        verify(projects, never()).insert(any());
    }

    @Test void duplicatingLegacyVideoClearsSystemMusicWithoutChangingTheOriginal() {
        var legacy = rows.computeIfAbsent(5L, id -> new VideoProjectEntity());
        legacy.id = 5L; legacy.userId = 1L; legacy.tripId = 2L; legacy.templateCode = "JOURNAL";
        legacy.aspectRatio = "9:16"; legacy.quality = "720p"; legacy.duration = 15;
        legacy.musicCode = "LEGACY"; legacy.musicSource = "SYSTEM"; legacy.status = "COMPLETED";
        legacy.outputUrl = "https://example.invalid/already-rendered.mp4";
        var copy = service.duplicate(1L, 5L);
        assertNull(copy.musicCode()); assertNull(copy.musicSource()); assertNull(copy.userMusicId());
        assertEquals("LEGACY", legacy.musicCode); assertEquals("COMPLETED", legacy.status);
        assertNotNull(legacy.outputUrl);
        legacy.musicCode = null; legacy.musicSource = "USER"; legacy.userMusicId = 9L;
        var ownCopy = service.duplicate(1L, 5L);
        assertEquals("USER", ownCopy.musicSource()); assertEquals(9L, ownCopy.userMusicId());
    }
}
