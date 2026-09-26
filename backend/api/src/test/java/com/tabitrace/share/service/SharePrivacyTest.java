package com.tabitrace.share.service;

import com.tabitrace.checkin.dto.CheckinDtos.CheckinView;
import com.tabitrace.checkin.dto.CheckinDtos.TimelineDay;
import com.tabitrace.checkin.dto.CheckinDtos.TimelineItem;
import com.tabitrace.user.entity.UserEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SharePrivacyTest {
    @Test
    void publicTimelineOnlyKeepsCoarseCoordinates() {
        CheckinView c = new CheckinView(1L, 2L, null, null, "MANUAL", OffsetDateTime.now(), new BigDecimal("35.7147651"), new BigDecimal("139.7966553"), "酒店", "浅草", "note", null);
        CheckinView noGps = new CheckinView(3L, 2L, null, null, "MANUAL", OffsetDateTime.now(), null, null, "某处", null, null, null);
        var out = ShareService.coarsen(List.of(new TimelineDay(LocalDate.now(), List.of(new TimelineItem(c, List.of()), new TimelineItem(noGps, List.of())))));
        CheckinView r = out.get(0).items().get(0).checkin();
        assertEquals(new BigDecimal("35.71"), r.latitude());
        assertEquals(new BigDecimal("139.80"), r.longitude());
        assertEquals("酒店", r.placeName());
        assertNull(out.get(0).items().get(1).checkin().latitude());
    }

    @Test
    void defaultShareExpiryFollowsUserSetting() {
        UserEntity u = new UserEntity();
        assertNull(ShareService.defaultExpiry(u));
        u.shareLinkExpiryDays = 0;
        assertNull(ShareService.defaultExpiry(u));
        u.shareLinkExpiryDays = 7;
        LocalDateTime expected = LocalDateTime.now(ZoneOffset.UTC).plusDays(7);
        assertTrue(Math.abs(Duration.between(ShareService.defaultExpiry(u), expected).toSeconds()) < 5);
    }
}
