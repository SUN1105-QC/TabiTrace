package com.tabitrace.share.entity;

import java.time.LocalDateTime;

public class ShareLinkEntity {
    public Long id;
    public Long tripId;
    public String shareToken;
    public String status;
    public Long viewCount;
    public LocalDateTime createdAt;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
}
