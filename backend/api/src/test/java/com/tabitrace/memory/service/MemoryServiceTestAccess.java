package com.tabitrace.memory.service;

import com.tabitrace.trip.entity.TripEntity;
import java.time.LocalDate;

/** 测试访问 MemoryService 的包内静态方法 */
public final class MemoryServiceTestAccess {
    private MemoryServiceTestAccess() {}
    public static int matchYears(TripEntity t, LocalDate today, String kind) { return MemoryService.matchYears(t, today, kind); }
}
