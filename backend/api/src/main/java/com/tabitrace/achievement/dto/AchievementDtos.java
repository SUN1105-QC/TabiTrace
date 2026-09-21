package com.tabitrace.achievement.dto;

import java.time.LocalDateTime;

public final class AchievementDtos {
    private AchievementDtos() {}
    public record AchievementView(Long id,String code,String name,String description,String type,String cityCode,String iconUrl,boolean earned,int progress,LocalDateTime earnedAt) {}
}
