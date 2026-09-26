package com.tabitrace.achievement;

import com.tabitrace.achievement.entity.AchievementEntity;
import com.tabitrace.achievement.service.AchievementServiceTestAccess;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class AchievementMeasureTest {

    private static AchievementEntity a(String type, Integer value) {
        AchievementEntity e = new AchievementEntity();
        e.conditionType = type;
        e.conditionValue = value;
        return e;
    }

    @Test
    void countsExposeCurrentAndTarget() {
        var stats = AchievementServiceTestAccess.stats(3, 12, 2, 1, Set.of(), false);
        assertArrayEquals(new int[]{2, 5, 40}, AchievementServiceTestAccess.measure(a("AREA_COUNT", 5), stats));
        // 超过目标时 current 保留真实值，百分比封顶 100
        assertArrayEquals(new int[]{12, 10, 100}, AchievementServiceTestAccess.measure(a("PHOTO_COUNT", 10), stats));
    }

    @Test
    void missingOrInvalidTargetFallsBackToOne() {
        var stats = AchievementServiceTestAccess.stats(1, 0, 0, 0, Set.of(), false);
        assertArrayEquals(new int[]{1, 1, 100}, AchievementServiceTestAccess.measure(a("CHECKIN_COUNT", 0), stats));
        assertArrayEquals(new int[]{1, 1, 100}, AchievementServiceTestAccess.measure(a("CHECKIN_COUNT", null), stats));
    }

    @Test
    void placeBasedAchievementsListEachRequiredPlace() {
        var stats = AchievementServiceTestAccess.stats(4, 0, 0, 0, Set.of("浅草寺", "东京塔"), false);
        assertArrayEquals(new int[]{1, 2, 50}, AchievementServiceTestAccess.measure(a("TOKYO_TRADITION", 2), stats));
        assertEquals("浅草寺:true,明治神宫:false", AchievementServiceTestAccess.requirements(a("TOKYO_TRADITION", 2), stats));
        assertArrayEquals(new int[]{1, 3, 33}, AchievementServiceTestAccess.measure(a("TOKYO_NIGHT", 3), stats));
    }

    @Test
    void tripCompletionIsBinary() {
        assertArrayEquals(new int[]{0, 1, 0}, AchievementServiceTestAccess.measure(a("TRIP_COMPLETED", 1), AchievementServiceTestAccess.stats(0, 0, 0, 0, Set.of(), false)));
        assertArrayEquals(new int[]{1, 1, 100}, AchievementServiceTestAccess.measure(a("TRIP_COMPLETED", 1), AchievementServiceTestAccess.stats(0, 0, 0, 0, Set.of(), true)));
    }
}
