package com.tabitrace.checkin;

import com.tabitrace.checkin.dto.CheckinDtos.RecentRecord;
import com.tabitrace.checkin.service.RecentRecordServiceTestAccess;
import com.tabitrace.photo.entity.PhotoEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RecentRecordTest {
    static PhotoEntity photo(long id, LocalDateTime utc, String url) {
        PhotoEntity p = new PhotoEntity(); p.id = id; p.createdAt = utc; p.imageUrl = url; return p;
    }

    @Test
    void unattachedPhotosAreGroupedByLocalDay() {
        ZoneId tokyo = ZoneId.of("Asia/Tokyo");
        // UTC 16:00 与 UTC 14:00 在东京分别是次日 01:00 和当日 23:00，应分成两天
        var list = List.of(
                photo(3, LocalDateTime.of(2026, 9, 20, 16, 0), "c"),
                photo(2, LocalDateTime.of(2026, 9, 20, 14, 0), "b"),
                photo(1, LocalDateTime.of(2026, 9, 20, 13, 0), "a"));
        List<RecentRecord> out = RecentRecordServiceTestAccess.group(list, tokyo);
        assertEquals(2, out.size());
        assertEquals(1, out.get(0).photoCount());
        assertEquals("c", out.get(0).thumbnailUrl());
        assertEquals(2, out.get(1).photoCount());
        assertEquals("b", out.get(1).thumbnailUrl());
        assertEquals("PHOTOS", out.get(1).kind());
    }

    @Test
    void mergeKeepsNewestFirstAndLimits() {
        OffsetDateTime base = OffsetDateTime.of(2026, 9, 20, 10, 0, 0, 0, ZoneOffset.ofHours(9));
        var records = List.of(
                new RecentRecord("CHECKIN", 1L, "浅草寺", null, "MANUAL", base, 0, null, null),
                new RecentRecord("PHOTOS", null, null, null, null, base.plusHours(3), 4, "x", null),
                new RecentRecord("CHECKIN", 2L, "东京塔", null, "MANUAL", base.plusHours(1), 2, "y", null),
                new RecentRecord("CHECKIN", 3L, "无时间", null, "MANUAL", null, 0, null, null));
        List<RecentRecord> out = RecentRecordServiceTestAccess.merge(records, 2);
        assertEquals(2, out.size());
        assertEquals("PHOTOS", out.get(0).kind());
        assertEquals("东京塔", out.get(1).placeName());
    }
}
