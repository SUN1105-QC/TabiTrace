package com.tabitrace.checkin.service;

import com.tabitrace.checkin.dto.CheckinDtos.RecentRecord;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

/**
 * 旅行详情“最近记录”：最近几次打卡（附照片数与第一张照片），
 * 加上没有关联打卡、单独上传的照片（按当地日期合并成“上传了 N 张照片”）。
 * 只查询需要的条数，不加载整条时间轴。
 */
@Service
public class RecentRecordService {
    public static final int MAX_LIMIT = 5;
    /** 单独上传的照片最多看最近这么多张来合并成记录 */
    static final int UNATTACHED_SCAN = 60;

    private final CheckinMapper checkins; private final PhotoMapper photos; private final TripService trips; private final UserMapper users;
    public RecentRecordService(CheckinMapper checkins, PhotoMapper photos, TripService trips, UserMapper users) {
        this.checkins = checkins; this.photos = photos; this.trips = trips; this.users = users;
    }

    public List<RecentRecord> recent(Long userId, Long tripId, int limit) {
        trips.requireOwned(userId, tripId);
        int n = Math.max(1, Math.min(MAX_LIMIT, limit));
        ZoneId zone = zone(userId);
        List<RecentRecord> out = new ArrayList<>();
        for (CheckinEntity c : checkins.recentByTrip(tripId, n)) {
            List<PhotoEntity> ps = photos.listByCheckin(c.id);
            out.add(new RecentRecord("CHECKIN", c.id, c.placeNameSnapshot, c.areaSnapshot, c.checkinType, at(c.checkinTime, zone), ps.size(),
                    ps.isEmpty() ? null : ps.get(0).imageUrl, c.note));
        }
        out.addAll(groupUnattached(photos.recentUnattached(tripId, UNATTACHED_SCAN), zone));
        return merge(out, n);
    }

    /** 单独上传的照片按当地日期合并，一天一条记录，缩略图用当天最新的一张 */
    static List<RecentRecord> groupUnattached(List<PhotoEntity> list, ZoneId zone) {
        Map<LocalDate, List<PhotoEntity>> byDay = new LinkedHashMap<>();
        for (PhotoEntity p : list) {
            OffsetDateTime t = at(p.capturedAt != null ? p.capturedAt : p.createdAt, zone);
            if (t == null) continue;
            byDay.computeIfAbsent(t.toLocalDate(), k -> new ArrayList<>()).add(p);
        }
        List<RecentRecord> out = new ArrayList<>();
        byDay.forEach((day, ps) -> {
            PhotoEntity latest = ps.get(0);
            out.add(new RecentRecord("PHOTOS", null, null, null, null, at(latest.capturedAt != null ? latest.capturedAt : latest.createdAt, zone), ps.size(), latest.imageUrl, null));
        });
        return out;
    }

    /** 按时间倒序取前 n 条 */
    static List<RecentRecord> merge(List<RecentRecord> all, int n) {
        return all.stream().filter(r -> r.at() != null)
                .sorted(Comparator.comparing(RecentRecord::at).reversed())
                .limit(n).toList();
    }

    private static OffsetDateTime at(LocalDateTime utc, ZoneId zone) {
        return utc == null ? null : utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toOffsetDateTime();
    }

    private ZoneId zone(Long userId) {
        var u = users.findById(userId);
        try { return ZoneId.of(u == null || u.timezone == null ? "UTC" : u.timezone); } catch (Exception e) { return ZoneId.of("UTC"); }
    }
}
