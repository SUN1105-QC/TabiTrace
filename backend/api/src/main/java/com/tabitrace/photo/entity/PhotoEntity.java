package com.tabitrace.photo.entity;

import java.time.LocalDateTime;

public class PhotoEntity {
    public Long id;
    public Long userId;
    public Long tripId;
    public Long checkinId;
    public String storageKey;
    public String imageUrl;
    public Integer width;
    public Integer height;
    public Long fileSize;
    public String mimeType;
    public Boolean featured;
    public LocalDateTime capturedAt;
    public LocalDateTime createdAt;
}
