package com.tabitrace.usermusic.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 用户上传的音乐（与系统曲库 video_music 分开）。storageKey 由服务端随机生成，只保存存储路径 */
public class UserMusicEntity {
    public Long id;
    public Long userId;
    public String title;
    public String originalFilename;
    public String storageKey;
    public String mimeType;
    public Long fileSize;
    public BigDecimal durationSeconds;
    /** UPLOADING / PROCESSING / READY / FAILED / DELETED */
    public String status;
    public String failureCode;
    public Boolean copyrightConfirmed;
    public LocalDateTime copyrightConfirmedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public LocalDateTime deletedAt;
    public LocalDateTime purgedAt;

    public boolean ready() { return "READY".equals(status); }
}
