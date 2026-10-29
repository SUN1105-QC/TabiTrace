package com.tabitrace.video.entity;

import java.time.LocalDateTime;

public class VideoProjectEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    public String name;
    public String templateCode;
    public String aspectRatio;
    public Integer duration;
    public String quality;
    public Long coverPhotoId;
    /** 系统曲库音乐（music_source = SYSTEM 时） */
    public String musicCode;
    /** SYSTEM（video_music）/ USER（user_music）/ null（无音乐） */
    public String musicSource;
    /** 「我的音乐」的 id（music_source = USER 时）；不保存音乐地址 */
    public Long userMusicId;
    public Boolean showText;
    public Boolean showAchievements;
    /** 故事内容设置（StorySettings 的 JSON） */
    public String settingsJson;
    /** 开始生成时冻结的分镜（StoryboardView 的 JSON），Worker 只按它渲染 */
    public String storyboardJson;
    public String status;
    public Integer progress;
    /** PREPARING / STORY / MUSIC / EXPORTING / UPLOADING */
    public String renderStage;
    /** MOCK = API 内置模拟渲染器，FFMPEG = 真实 Worker */
    public String renderer;
    public String outputKey;
    public String outputUrl;
    /** Actual encoded file length, recorded by the worker; null means an unmeasured historical output. */
    public Long outputBytes;
    public String errorCode;
    public String errorMessage;
    /** 生成成功但有降级（MUSIC_FALLBACK：音乐不可用，已用无音乐生成） */
    public String renderWarning;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public LocalDateTime completedAt;
}
