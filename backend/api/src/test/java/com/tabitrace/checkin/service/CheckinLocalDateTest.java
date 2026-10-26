package com.tabitrace.checkin.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.trip.entity.TripEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/** 打卡日期按打卡地的当地日期判断是否在旅行日期内（请求里的时间经 Jackson 反序列化后是 UTC） */
class CheckinLocalDateTest {
    private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");

    private static TripEntity trip() {
        TripEntity t = new TripEntity(); t.startDate = LocalDate.of(2026, 10, 11); t.endDate = LocalDate.of(2026, 10, 13);
        return t;
    }

    @Test
    void earlyMorningOnTheFirstDayIsInsideTheTrip() {
        // 东京 10 月 11 日 06:08 = UTC 10 月 10 日 21:08：按 UTC 日期会被误判为旅行开始前一天
        OffsetDateTime utc = OffsetDateTime.of(2026, 10, 10, 21, 8, 0, 0, ZoneOffset.UTC);
        assertDoesNotThrow(() -> CheckinService.validateLocalDate(trip(), utc, TOKYO));
    }

    @Test
    void lateNightAfterTheLastDayIsOutside() {
        // 东京 10 月 14 日 00:30 = UTC 10 月 13 日 15:30：当地已经是旅行结束后的第二天
        OffsetDateTime utc = OffsetDateTime.of(2026, 10, 13, 15, 30, 0, 0, ZoneOffset.UTC);
        BusinessException ex = assertThrows(BusinessException.class, () -> CheckinService.validateLocalDate(trip(), utc, TOKYO));
        assertEquals("CHECKIN_TIME_OUTSIDE_TRIP", ex.getCode());
    }

    @Test
    void theDayBeforeTheTripIsOutside() {
        OffsetDateTime local = OffsetDateTime.of(2026, 10, 10, 23, 0, 0, 0, ZoneOffset.ofHours(9));
        assertThrows(BusinessException.class, () -> CheckinService.validateLocalDate(trip(), local, TOKYO));
    }
}
