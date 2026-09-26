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
    public String musicCode;
    public Boolean showText;
    public Boolean showMap;
    public Boolean showAchievements;
    /** 故事内容设置（StorySettings 的 JSON） */
    public String settingsJson;
    /** 开始生成时冻结的分镜（StoryboardView 的 JSON），Worker 只按它渲染 */
    public String storyboardJson;
    public String status;
    public Integer progress;
    /** PREPARING / MAP / STORY / MUSIC / EXPORTING / UPLOADING */
    public String renderStage;
    /** MOCK = API 内置模拟渲染器，FFMPEG = 真实 Worker */
    public String renderer;
    public String outputKey;
    public String outputUrl;
    public String errorCode;
    public String errorMessage;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public LocalDateTime completedAt;
}
