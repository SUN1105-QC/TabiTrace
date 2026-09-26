package com.tabitrace.achievement.service;

import com.tabitrace.achievement.entity.AchievementEntity;
import java.util.Set;
import java.util.stream.Collectors;

/** 测试访问 AchievementService 的包内计算逻辑 */
public final class AchievementServiceTestAccess {
    private AchievementServiceTestAccess() {}

    public static Object stats(int checkins, int photos, int areas, int official, Set<String> visited, boolean completed) {
        return new AchievementService.Stats(checkins, photos, areas, official, visited, completed);
    }

    /** 返回 {current, target, percent} */
    public static int[] measure(AchievementEntity a, Object stats) {
        var m = AchievementService.measure(a, (AchievementService.Stats) stats);
        return new int[]{m.current(), m.target(), m.percent()};
    }

    public static String requirements(AchievementEntity a, Object stats) {
        return AchievementService.measure(a, (AchievementService.Stats) stats).requirements().stream()
                .map(r -> r.name() + ":" + r.done()).collect(Collectors.joining(","));
    }
}
