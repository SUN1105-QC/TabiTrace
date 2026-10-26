package com.tabitrace.usermusic;

import com.tabitrace.common.BusinessException;
import com.tabitrace.membership.entity.MembershipEntity;
import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.usermusic.dto.UserMusicDtos.UploadUrlRequest;
import com.tabitrace.usermusic.entity.UserMusicEntity;
import com.tabitrace.usermusic.mapper.UserMusicMapper;
import com.tabitrace.usermusic.service.UserMusicProperties;
import com.tabitrace.usermusic.service.UserMusicService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 「我的音乐」服务端规则：会员门槛、版权确认、扩展名 + MIME + 内容三重校验、大小与额度、随机存储路径、
 * 只能操作自己的音乐（IDOR），以及删除时不影响排队中的视频。
 */
class UserMusicServiceTest {
    static final long ME = 1L, OTHER = 2L;
    UserMusicMapper mapper;
    StorageService storage;
    MembershipMapper memberships;
    UserMusicService service;
    final Map<Long, UserMusicEntity> rows = new HashMap<>();
    final List<MembershipEntity> myMembership = new ArrayList<>();

    @BeforeEach void setUp() {
        mapper = mock(UserMusicMapper.class);
        storage = mock(StorageService.class);
        memberships = mock(MembershipMapper.class);
        when(memberships.listByUser(anyLong())).thenAnswer(i -> (Long) i.getArgument(0) == ME ? myMembership : List.of());
        when(mapper.findById(anyLong())).thenAnswer(i -> rows.get((Long) i.getArgument(0)));
        when(mapper.usage(anyLong())).thenReturn(Map.of("tracks", 0L, "bytes", 0L));
        doAnswer(i -> { UserMusicEntity m = i.getArgument(0); m.id = 100L + rows.size(); rows.put(m.id, m); return 1; }).when(mapper).insert(any());
        when(mapper.claim(anyLong())).thenAnswer(i -> { rows.get((Long) i.getArgument(0)).status = "PROCESSING"; return 1; });
        when(mapper.fail(anyLong(), anyString())).thenAnswer(i -> { UserMusicEntity m = rows.get((Long) i.getArgument(0)); m.status = "FAILED"; m.failureCode = i.getArgument(1); return 1; });
        when(mapper.ready(anyLong(), anyString(), anyLong(), any())).thenAnswer(i -> { UserMusicEntity m = rows.get((Long) i.getArgument(0)); m.status = "READY"; m.durationSeconds = i.getArgument(3); return 1; });
        when(storage.presignKey(anyString(), anyString(), anyLong())).thenAnswer(i -> new PresignResponse(i.getArgument(0), "https://upload.example/" + i.getArgument(0), null, 900, false));
        when(storage.exists(anyString())).thenReturn(true);
        service = new UserMusicService(mapper, storage, new MembershipService(memberships), UserMusicProperties.defaults());
    }

    void becomeMember() {
        MembershipEntity m = new MembershipEntity();
        m.userId = ME; m.source = "LIFETIME"; m.status = "ACTIVE"; m.startedAt = LocalDateTime.now(ZoneOffset.UTC).minusDays(1);
        myMembership.add(m);
    }

    void expireMembership() {
        MembershipEntity m = new MembershipEntity();
        m.userId = ME; m.source = "SUBSCRIPTION"; m.status = "ACTIVE";
        m.startedAt = LocalDateTime.now(ZoneOffset.UTC).minusDays(40); m.expiresAt = LocalDateTime.now(ZoneOffset.UTC).minusDays(1);
        myMembership.clear(); myMembership.add(m);
    }

    static UploadUrlRequest req(String name, String type, long size) { return new UploadUrlRequest(name, type, size, null, true); }

    UserMusicEntity stored(long owner, String status, String ext) {
        UserMusicEntity m = new UserMusicEntity();
        m.id = 500L + rows.size(); m.userId = owner; m.status = status; m.title = "Tokyo Memories"; m.fileSize = 1000L;
        m.storageKey = "user-music/" + owner + "/" + m.id + "-uuid." + ext; m.mimeType = "audio/mpeg";
        rows.put(m.id, m);
        return m;
    }

    static void assertCode(String code, Runnable r) {
        BusinessException ex = assertThrows(BusinessException.class, r::run);
        assertEquals(code, ex.getCode(), ex.getMessage());
    }

    // ───── 会员门槛（后端强制，不靠前端按钮）─────

    @Test void freeUserCannotGetUploadUrl() {
        BusinessException ex = assertThrows(BusinessException.class, () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 1000)));
        assertEquals("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        verify(mapper, never()).insert(any());
    }

    @Test void expiredMemberCannotUploadButLibraryIsReadOnly() {
        expireMembership();
        assertCode("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 1000)));
        var lib = service.library(ME);
        assertEquals("EXPIRED", lib.membership().status());
        assertFalse(lib.canUpload());
        assertFalse(lib.canUse());
    }

    @Test void copyrightMustBeConfirmed() {
        becomeMember();
        assertCode("COPYRIGHT_CONFIRMATION_REQUIRED", () -> service.uploadUrl(ME, new UploadUrlRequest("a.mp3", "audio/mpeg", 1000L, null, false)));
        assertCode("COPYRIGHT_CONFIRMATION_REQUIRED", () -> service.uploadUrl(ME, new UploadUrlRequest("a.mp3", "audio/mpeg", 1000L, null, null)));
    }

    // ───── 扩展名 + MIME ─────

    @Test void onlyMp3M4aWavWithMatchingMime() {
        becomeMember();
        assertCode("USER_MUSIC_TYPE_UNSUPPORTED", () -> service.uploadUrl(ME, req("setup.exe", "application/octet-stream", 1000)));
        assertCode("USER_MUSIC_TYPE_UNSUPPORTED", () -> service.uploadUrl(ME, req("songs.zip", "application/zip", 1000)));
        assertCode("USER_MUSIC_TYPE_UNSUPPORTED", () -> service.uploadUrl(ME, req("clip.mp4", "video/mp4", 1000)));
        assertCode("USER_MUSIC_TYPE_UNSUPPORTED", () -> service.uploadUrl(ME, req("clip.mp3", "video/mp4", 1000)));
        assertCode("USER_MUSIC_TYPE_UNSUPPORTED", () -> service.uploadUrl(ME, req("song", "audio/mpeg", 1000)));
        assertCode("USER_MUSIC_TYPE_MISMATCH", () -> service.uploadUrl(ME, req("song.mp3", "audio/wav", 1000)));
        assertDoesNotThrow(() -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 1000)));
        assertDoesNotThrow(() -> service.uploadUrl(ME, req("b.M4A", "audio/x-m4a", 1000)));
        assertDoesNotThrow(() -> service.uploadUrl(ME, req("c.wav", "audio/wav", 1000)));
        assertDoesNotThrow(() -> service.uploadUrl(ME, req("d.wav", "audio/x-wav", 1000)));
    }

    // ───── 大小与额度 ─────

    @Test void sizeAndQuotaAreEnforced() {
        becomeMember();
        long max = UserMusicProperties.defaults().maxFileBytes;
        BusinessException big = assertThrows(BusinessException.class, () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", max + 1)));
        assertEquals("USER_MUSIC_TOO_LARGE", big.getCode());
        assertEquals("文件超过 30MB，请压缩后再上传", big.getMessage());
        assertCode("USER_MUSIC_EMPTY", () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 0)));
        assertDoesNotThrow(() -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", max)));

        when(mapper.usage(ME)).thenReturn(Map.of("tracks", 20L, "bytes", 1000L));
        assertCode("USER_MUSIC_LIMIT", () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 1000)));
        when(mapper.usage(ME)).thenReturn(Map.of("tracks", 3L, "bytes", 500L * 1024 * 1024 - 10));
        assertCode("USER_MUSIC_STORAGE_FULL", () -> service.uploadUrl(ME, req("a.mp3", "audio/mpeg", 1000)));
    }

    // ───── 存储路径 ─────

    @Test void storageKeyIsRandomAndNeverUsesTheFileName() {
        becomeMember();
        var res = service.uploadUrl(ME, new UploadUrlRequest("..\\..\\windows/../etc/passwd 东京.mp3", "audio/mpeg", 1000L, null, true));
        UserMusicEntity m = rows.get(res.music().id());
        assertTrue(m.storageKey.matches("user-music/1/[0-9a-f-]{36}\\.mp3"), m.storageKey);
        assertEquals("passwd 东京.mp3", m.originalFilename);
        assertEquals("passwd 东京", m.title);
        assertTrue(m.copyrightConfirmed);
        assertNotNull(m.copyrightConfirmedAt);
        assertEquals("UPLOADING", m.status);
        verify(storage).presignKey(eq(m.storageKey), eq("audio/mpeg"), eq(1000L));
    }

    // ───── 完成登记：按内容识别 ─────

    @Test void completeReadsRealContent() {
        becomeMember();
        UserMusicEntity good = stored(ME, "UPLOADING", "mp3");
        when(storage.read(good.storageKey)).thenReturn(AudioProbeTest.mp3(400, true));
        var v = service.complete(ME, good.id);
        assertEquals("READY", v.status());
        assertEquals(10.4, v.durationSeconds(), 0.1);

        UserMusicEntity disguised = stored(ME, "UPLOADING", "mp3");
        when(storage.read(disguised.storageKey)).thenReturn(AudioProbeTest.wav(5));
        var bad = service.complete(ME, disguised.id);
        assertEquals("FAILED", bad.status());
        assertEquals("FORMAT_MISMATCH", bad.failureCode());
        assertNotNull(bad.failureMessage());
        verify(storage).delete(disguised.storageKey);

        UserMusicEntity video = stored(ME, "UPLOADING", "m4a");
        when(storage.read(video.storageKey)).thenReturn(AudioProbeTest.mp4("vide", "soun"));
        assertEquals("CONTAINS_VIDEO", service.complete(ME, video.id).failureCode());

        UserMusicEntity missing = stored(ME, "UPLOADING", "wav");
        when(storage.exists(missing.storageKey)).thenReturn(false);
        assertEquals("UPLOAD_MISSING", service.complete(ME, missing.id).failureCode());

        UserMusicEntity tiny = stored(ME, "UPLOADING", "wav");
        when(storage.read(tiny.storageKey)).thenReturn(AudioProbeTest.wav(1));
        assertEquals("DURATION_TOO_SHORT", service.complete(ME, tiny.id).failureCode());
    }

    @Test void completeRechecksMembership() {
        expireMembership();
        UserMusicEntity m = stored(ME, "UPLOADING", "mp3");
        assertCode("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", () -> service.complete(ME, m.id));
        assertEquals("FAILED", m.status);
        assertEquals("MEMBERSHIP_CHANGED", m.failureCode);
        verify(storage, never()).read(anyString());
    }

    // ───── IDOR：别人的音乐一律 404 ─────

    @Test void otherUsersMusicIsInvisible() {
        becomeMember();
        UserMusicEntity theirs = stored(OTHER, "READY", "mp3");
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.playUrl(ME, theirs.id));
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.rename(ME, theirs.id, "mine now"));
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.delete(ME, theirs.id));
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.complete(ME, theirs.id));
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.requireUsable(ME, theirs.id));
        assertCode("USER_MUSIC_NOT_FOUND", () -> service.playUrl(ME, 99999L));
        verify(mapper, never()).softDelete(anyLong(), anyLong());
        verify(mapper, never()).rename(anyLong(), anyLong(), anyString());
        verify(storage, never()).signedReadUrl(anyString(), anyLong());
    }

    // ───── 试听 / 删除 / 用于视频 ─────

    @Test void expiredMemberCanStillListenAndDelete() {
        expireMembership();
        UserMusicEntity m = stored(ME, "READY", "mp3");
        when(storage.signedReadUrl(eq(m.storageKey), anyLong())).thenReturn("https://signed.example/x");
        assertEquals("https://signed.example/x", service.playUrl(ME, m.id).url());
        assertCode("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", () -> service.rename(ME, m.id, "new"));
        assertCode("CUSTOM_MUSIC_REQUIRES_MEMBERSHIP", () -> service.requireUsable(ME, m.id));
        assertDoesNotThrow(() -> service.delete(ME, m.id));
        verify(mapper).softDelete(m.id, ME);
    }

    @Test void deleteKeepsFileWhileAVideoIsRendering() {
        becomeMember();
        UserMusicEntity busy = stored(ME, "READY", "mp3");
        when(mapper.countActiveRenders(busy.id)).thenReturn(1);
        service.delete(ME, busy.id);
        verify(mapper).softDelete(busy.id, ME);
        verify(storage, never()).delete(busy.storageKey);

        UserMusicEntity idle = stored(ME, "READY", "mp3");
        service.delete(ME, idle.id);
        verify(storage).delete(idle.storageKey);
        verify(mapper).markPurged(idle.id);
    }

    @Test void deletedMusicCannotBeUsedForNewVideos() {
        becomeMember();
        UserMusicEntity gone = stored(ME, "DELETED", "mp3");
        assertCode("VIDEO_USER_MUSIC_DELETED", () -> service.requireUsable(ME, gone.id));
        UserMusicEntity failed = stored(ME, "FAILED", "mp3");
        assertCode("VIDEO_USER_MUSIC_UNAVAILABLE", () -> service.requireUsable(ME, failed.id));
        UserMusicEntity ok = stored(ME, "READY", "mp3");
        assertSame(ok, service.requireUsable(ME, ok.id));
    }
}
