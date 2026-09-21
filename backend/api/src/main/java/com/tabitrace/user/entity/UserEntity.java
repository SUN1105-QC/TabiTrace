package com.tabitrace.user.entity;

import java.time.LocalDateTime;

public class UserEntity {
    public Long id;
    public String email;
    public String passwordHash;
    public String nickname;
    public String avatarUrl;
    public String status;
    public String locale;
    public String timezone;
    public String defaultVisibility;
    public Boolean emailNotifications;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
