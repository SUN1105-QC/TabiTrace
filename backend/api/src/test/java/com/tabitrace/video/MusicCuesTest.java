package com.tabitrace.video;

import com.tabitrace.video.entity.VideoMusicEntity;
import com.tabitrace.video.service.MusicCues;
import com.tabitrace.video.service.MusicCues.MusicCue;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** 音乐片段：按高潮段取不同长度的片段、统一响度、署名 */
class MusicCuesTest {
    static VideoMusicEntity track(double duration, double highlight, Number lufs) {
        VideoMusicEntity m = new VideoMusicEntity();
        m.code = "SB_WANDERLUST"; m.name = "Wanderlust"; m.artist = "Scott Buckley"; m.license = "CC BY 4.0";
        m.durationSeconds = BigDecimal.valueOf(duration); m.highlightStart = BigDecimal.valueOf(highlight);
        m.loudnessLufs = lufs == null ? null : BigDecimal.valueOf(lufs.doubleValue());
        m.objectKey = "music/originals/sb_wanderlust-abc.mp3";
        m.attributionRequired = true; m.attributionText = "'Wanderlust' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au";
        m.enabled = true; m.status = "APPROVED";
        return m;
    }

    @Test void shortVideosStartNearTheHighlightNotAtZero() {
        VideoMusicEntity m = track(168.2, 119.5, -14.2);
        assertEquals(117.5, MusicCues.cue(m, 15, null).startSeconds());
        assertEquals(111.5, MusicCues.cue(m, 30, null).startSeconds());
        assertEquals(95.5, MusicCues.cue(m, 60, null).startSeconds());
    }

    @Test void segmentNeverRunsPastTheEndAndShortTracksLoop() {
        MusicCue late = MusicCues.cue(track(120, 118, -14), 60, null);
        assertEquals(59.0, late.startSeconds(), "片段要完整落在原曲内");
        assertFalse(late.loop());
        MusicCue shortTrack = MusicCues.cue(track(40, 20, -14), 60, null);
        assertEquals(0.0, shortTrack.startSeconds());
        assertTrue(shortTrack.loop());
        assertEquals(0.0, MusicCues.cue(track(200, 3, -14), 30, null).startSeconds(), "高潮在开头时从 0 开始");
    }

    @Test void loudnessIsNormalisedWithinSafeBoundsAndVolumeIsClamped() {
        assertEquals(12.0, MusicCues.cue(track(200, 50, -29.6), 30, null).gainDb(), "很轻的母带最多提升 12 dB");
        assertEquals(-7.5, MusicCues.cue(track(200, 50, -8.5), 30, null).gainDb());
        assertEquals(0.0, MusicCues.cue(track(200, 50, null), 30, null).gainDb());
        assertEquals(0.5, MusicCues.cue(track(200, 50, -16), 30, null).volume(), "默认音量 50%：背景音乐不抢画面");
        assertEquals(1.0, MusicCues.cue(track(200, 50, -16), 30, 150).volume());
        assertEquals(0.0, MusicCues.cue(track(200, 50, -16), 30, -5).volume());
    }

    @Test void attributionIsCarriedForCcByAndFadesAreSet() {
        MusicCue c = MusicCues.cue(track(200, 50, -16), 30, 60);
        assertEquals("Music: “Wanderlust” – Scott Buckley · CC BY 4.0", c.creditShort());
        assertTrue(c.credit().contains("CC-BY 4.0"));
        assertEquals("music/originals/sb_wanderlust-abc.mp3", c.objectKey());
        assertTrue(c.fadeInSeconds() >= 0.5 && c.fadeInSeconds() <= 1.5);
        assertTrue(c.fadeOutSeconds() >= 1 && c.fadeOutSeconds() <= 2);
        assertNull(MusicCues.cue(null, 30, null), "无音乐（music_code = NULL）不生成音乐片段");
    }
}
