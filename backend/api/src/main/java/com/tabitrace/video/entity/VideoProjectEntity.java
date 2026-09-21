package com.tabitrace.video.entity;

import java.time.LocalDateTime;

public class VideoProjectEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    public String templateCode;
    public String aspectRatio;
    public Integer duration;
    public String musicCode;
    public Boolean showText;
    public Boolean showMap;
    public Boolean showAchievements;
    public String status;
    public Integer progress;
    public String outputKey;
    public String outputUrl;
    public String errorMessage;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public LocalDateTime completedAt;
}
