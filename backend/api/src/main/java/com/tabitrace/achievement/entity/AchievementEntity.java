package com.tabitrace.achievement.entity;

import java.time.LocalDateTime;

public class AchievementEntity {
    public Long id;
    public String code;
    public String name;
    public String description;
    public String type;
    public String cityCode;
    public String iconUrl;
    public String conditionType;
    public Integer conditionValue;
    public LocalDateTime createdAt;
}
