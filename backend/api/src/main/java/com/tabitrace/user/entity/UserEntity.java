package com.tabitrace.user.entity;

import java.time.LocalDateTime;

public class UserEntity {
    public Long id;
    public String email;
    public String passwordHash;
    public String nickname;
    public String avatarUrl;
    public String bio;
    public String status;
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
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
