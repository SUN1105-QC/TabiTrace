package com.tabitrace.memory;

import com.tabitrace.memory.service.MemoryServiceTestAccess;
import com.tabitrace.trip.entity.TripEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MemoryFlashbackTest {

    private static TripEntity trip(String start, String end) {
        TripEntity t = new TripEntity();
        t.startDate = LocalDate.parse(start);
        t.endDate = LocalDate.parse(end);
        return t;
    }

    @Test
    void sameDayWithinThreeDaysOfAPreviousYearMatches() {
        LocalDate today = LocalDate.parse("2026-09-25");
        assertEquals(1, MemoryServiceTestAccess.matchYears(trip("2025-09-20", "2025-09-23"), today, "DAY"));
        assertEquals(0, MemoryServiceTestAccess.matchYears(trip("2025-09-10", "2025-09-15"), today, "DAY"));
        assertEquals(3, MemoryServiceTestAccess.matchYears(trip("2023-09-27", "2023-09-28"), today, "DAY"));
    }

    @Test
    void trialsThisYearOrLaterNeverCountAsFlashbacks() {
        LocalDate today = LocalDate.parse("2026-09-25");
        assertEquals(0, MemoryServiceTestAccess.matchYears(trip("2026-09-24", "2026-09-26"), today, "DAY"));
    }

    @Test
    void fallsBackToSameMonthAndSameSeason() {
        LocalDate today = LocalDate.parse("2026-09-25");
        assertEquals(1, MemoryServiceTestAccess.matchYears(trip("2025-09-02", "2025-09-04"), today, "MONTH"));
        assertEquals(0, MemoryServiceTestAccess.matchYears(trip("2025-10-02", "2025-10-04"), today, "MONTH"));
        assertEquals(1, MemoryServiceTestAccess.matchYears(trip("2025-10-02", "2025-10-04"), today, "SEASON"));
        assertEquals(0, MemoryServiceTestAccess.matchYears(trip("2025-12-02", "2025-12-04"), today, "SEASON"));
    }

    @Test
    void newYearWrapAroundStillCountsAsTheSameDay() {
        LocalDate today = LocalDate.parse("2027-01-01");
        assertEquals(1, MemoryServiceTestAccess.matchYears(trip("2025-12-30", "2025-12-30"), today, "DAY"));
    }
}
