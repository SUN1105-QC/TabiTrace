package com.tabitrace.video.service;

import com.tabitrace.usermusic.entity.UserMusicEntity;
import com.tabitrace.video.entity.VideoMusicEntity;

import java.math.BigDecimal;

/**
 * 生成视频时锁定的音乐片段（冻结进分镜 JSON 的内部字段，Worker 只按它渲染）。
 * 不同时长不再永远从 0:00 开始：以曲目的高潮段为锚点，让高潮落在视频的前段 / 中段。
 */
public final class MusicCues {
    private MusicCues() {}

    /** 背景音乐默认音量：统一到 -16 LUFS 后再乘 0.5，作为旅行视频的背景层不抢画面 */
    public static final int DEFAULT_VOLUME = 50;
    /** 统一响度目标：不同来源的曲目音量差异很大（本曲库从 -29.6 到 -8.5 LUFS） */
    public static final double TARGET_LUFS = -16;
    public static final double FADE_IN_SECONDS = 1.0;
    public static final double FADE_OUT_SECONDS = 1.8;

    /**
     * @param objectKey   原曲存储路径（只给 Worker）
     * @param startSeconds 从原曲第几秒开始
     * @param gainDb      统一响度需要的增益（±12 dB 以内）
     * @param volume      用户设置的音量 0–1
     * @param loop        原曲比视频短时循环
     * @param creditShort 片尾显示的简短署名（CC BY 要求）；不需要署名时为 null
     * @param credit      完整署名文本（供用户复制到发布文案 / YouTube 描述）
     * @param source      SYSTEM（系统曲库）/ USER（「我的音乐」）
     * @param userMusicId 「我的音乐」的 id：Worker 按它重新核对音乐主人，不只相信分镜里的路径
     * @param loudnorm    没有预先测过响度（用户上传的音乐）：Worker 用 FFmpeg loudnorm 实时统一到 -16 LUFS
     */
    public record MusicCue(String code, String title, String artist, String objectKey, double startSeconds, double gainDb,
                           double volume, double fadeInSeconds, double fadeOutSeconds, boolean loop, String creditShort, String credit,
                           String source, Long userMusicId, boolean loudnorm) {}

    public static MusicCue cue(VideoMusicEntity m, int videoSeconds, Integer volumePercent) {
        if (m == null) return null;
        double track = num(m.durationSeconds, 0);
        double highlight = num(m.highlightStart, 0);
        // 高潮在视频中出现的位置：15 秒版一开场就是最好听的部分，30 / 60 秒版留出铺垫
        double lead = videoSeconds <= 15 ? 2 : videoSeconds <= 30 ? 8 : 24;
        boolean loop = track < videoSeconds + 1;
        double start = loop ? 0 : Math.max(0, Math.min(highlight - lead, track - videoSeconds - 1));
        double loudness = num(m.loudnessLufs, TARGET_LUFS);
        double gain = Math.max(-12, Math.min(12, TARGET_LUFS - loudness));
        int vol = volumePercent == null ? DEFAULT_VOLUME : Math.max(0, Math.min(100, volumePercent));
        boolean credit = Boolean.TRUE.equals(m.attributionRequired);
        return new MusicCue(m.code, m.name, m.artist, m.objectKey, round1(start), round1(gain), vol / 100.0,
                FADE_IN_SECONDS, FADE_OUT_SECONDS, loop,
                credit ? shortCredit(m) : null, credit ? m.attributionText : null, "SYSTEM", null, false);
    }

    /** 「我的音乐」：从头播放（没有高潮点分析），比视频短时循环；响度由 Worker 实时统一；不需要署名 */
    public static MusicCue userCue(UserMusicEntity m, int videoSeconds, Integer volumePercent) {
        if (m == null) return null;
        double track = num(m.durationSeconds, 0);
        int vol = volumePercent == null ? DEFAULT_VOLUME : Math.max(0, Math.min(100, volumePercent));
        return new MusicCue("USER:" + m.id, m.title, null, m.storageKey, 0, 0, vol / 100.0, FADE_IN_SECONDS, FADE_OUT_SECONDS,
                track < videoSeconds + 1, null, null, "USER", m.id, true);
    }

    /** 片尾署名：“曲名” – 作者 · 授权（CC BY 4.0 要求注明作者、作品与授权） */
    public static String shortCredit(VideoMusicEntity m) {
        return "Music: “" + m.name + "” – " + m.artist + " · " + m.license;
    }

    private static double num(BigDecimal v, double fallback) { return v == null ? fallback : v.doubleValue(); }
    private static double round1(double v) { return Math.round(v * 10) / 10.0; }
}
