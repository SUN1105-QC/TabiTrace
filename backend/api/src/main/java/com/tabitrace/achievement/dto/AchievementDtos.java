package com.tabitrace.achievement.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class AchievementDtos {
    private AchievementDtos() {}

    /** 需要打卡具体地点的成就（如东京传统派）的子条件：地点名与是否已打卡 */
    public record Requirement(String name, boolean done) {}

    /**
     * 一段旅行里的成就。progress 为 0~100 的完成百分比（保留给旧前端）；
     * conditionType / current / target 用于显示「还差 4 个区域」这样的真实进度；
     * requirements 仅在条件是若干具体地点时有值，否则为空列表。
     */
    public record AchievementView(Long id, String code, String name, String description, String type, String cityCode, String iconUrl,
                                  boolean earned, int progress, LocalDateTime earnedAt,
                                  String conditionType, int current, int target, List<Requirement> requirements) {}
}
