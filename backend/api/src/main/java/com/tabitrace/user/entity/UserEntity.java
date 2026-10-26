package com.tabitrace.user.entity;

import java.time.LocalDateTime;

public class UserEntity {
    public Long id;
    public String email;
    public String passwordHash;
    public String nickname;
    public String avatarUrl;
    /** 160×160 头像小图（导航栏等小尺寸显示用）；旧头像没有小图时为空 */
    public String avatarSmallUrl;
    public String bio;
    /** ACTIVE / DELETION_PENDING（注销冷静期） */
    public String status;
    public java.time.LocalDateTime deletionRequestedAt;
    public java.time.LocalDateTime deletionScheduledAt;
    public String locale;
    public String timezone;
    public String distanceUnit;
    public String defaultVisibility;
    public Boolean shareExactLocation;
    public Integer shareLinkExpiryDays;
    public Boolean emailNotifications;
    public Boolean notifyTripReminder;
    public Boolean notifyStory;
    public Boolean notifyAchievement;
    public Boolean notifyShare;
    /** 买断终身 Pro 的时间；为空表示没有买断 */
    public LocalDateTime lifetimeProAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
