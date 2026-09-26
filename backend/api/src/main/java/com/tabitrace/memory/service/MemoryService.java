package com.tabitrace.memory.service;

import com.tabitrace.achievement.mapper.AchievementMapper;
import com.tabitrace.memory.dto.MemoryDtos.*;
import com.tabitrace.memory.mapper.MemoryMapper;
import com.tabitrace.memory.mapper.MemoryMapper.PhotoRow;
import com.tabitrace.summary.dto.SummaryDtos.TripSummary;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 旅行回忆中心：把已完成 / 已归档旅行的统计、照片、Travel Story、分享页、成就聚合成一次请求。
 * 所有数字都来自数据库里的真实数据；缺什么就返回空，由前端隐藏对应模块。
 */
@Service
public class MemoryService {
    static final int MOMENTS = 3;
    static final int HIGHLIGHT_PHOTOS = 8;
    static final int RECENT_ACHIEVEMENTS = 6;
    static final int MAX_PAGE = 24;
    /** 往年今日：与今天相差不超过这么多天都算「同一天」 */
    static final int FLASHBACK_DAYS = 3;

    private final MemoryMapper mapper;
    private final SummaryService summaries;
    private final AchievementMapper achievements;
    private final UserMapper users;
    private final String publicUrl;

    public MemoryService(MemoryMapper mapper, SummaryService summaries, AchievementMapper achievements,
                         UserMapper users, @Value("${app.public-url:http://localhost:3000}") String publicUrl) {
        this.mapper = mapper;
        this.summaries = summaries;
        this.achievements = achievements;
        this.users = users;
        this.publicUrl = publicUrl.replaceAll("/$", "");
    }

    public MemoriesView memories(Long userId, int limit) {
        List<TripEntity> archived = mapper.archivedTrips(userId);
        LocalDate today = LocalDate.now(zone(userId));
        List<MemoryMapper.StoryRow> stories = mapper.stories(userId);
        List<MemoryMapper.ShareRow> shares = mapper.shareLinks(userId);

        Map<Long, String> covers = new HashMap<>();
        archived.forEach(t -> covers.put(t.id, cover(t, mapper.topPhotos(t.id, 1))));

        Set<String> cities = new LinkedHashSet<>();
        archived.forEach(t -> cities.add(cityOf(t)));
        Overview overview = new Overview(archived.size(), cities.size(), mapper.countArchivedPhotos(userId), stories.size() + shares.size());

        int size = clamp(limit);
        List<MemoryTrip> page = archived.stream().limit(size).map(t -> trip(userId, t, covers.get(t.id), stories, shares)).toList();
        List<TimelineEntry> timeline = archived.stream()
                .sorted(Comparator.comparing((TripEntity t) -> t.startDate).reversed())
                .map(t -> new TimelineEntry(t.id, t.title, cityOf(t), t.startDate, t.endDate, covers.get(t.id))).toList();

        int year = today.getYear();
        int photoYear = mapper.countPhotosInYear(userId, year) > 0 ? year : 0;
        List<MemoryPhoto> photos = mapper.highlightPhotos(userId, year, HIGHLIGHT_PHOTOS).stream()
                .map(p -> new MemoryPhoto(p.id, p.tripId, p.tripTitle, p.imageUrl, Boolean.TRUE.equals(p.featured), p.capturedAt != null ? p.capturedAt : p.createdAt)).toList();
        // 同一成就可能在多段旅行里各获得一次，只保留最近的那一次
        Set<String> seen = new HashSet<>();
        List<MemoryAchievement> recent = mapper.recentAchievements(userId, RECENT_ACHIEVEMENTS * 5).stream()
                .filter(a -> seen.add(a.code)).limit(RECENT_ACHIEVEMENTS)
                .map(a -> new MemoryAchievement(a.code, a.name, a.description, a.tripId, a.tripTitle, a.earnedAt)).toList();

        return new MemoriesView(overview, page, archived.size() > size, timeline, creations(stories, shares, covers), photos, photoYear,
                recent, mapper.countAchievements(userId), flashback(archived, today, covers));
    }

    /** 「查看更多」：按同样的排序继续往后取 */
    public TripPage trips(Long userId, int offset, int limit) {
        List<TripEntity> archived = mapper.archivedTrips(userId);
        int from = Math.max(0, Math.min(offset, archived.size()));
        int to = Math.min(archived.size(), from + clamp(limit));
        List<MemoryMapper.StoryRow> stories = mapper.stories(userId);
        List<MemoryMapper.ShareRow> shares = mapper.shareLinks(userId);
        List<MemoryTrip> page = archived.subList(from, to).stream().map(t -> trip(userId, t, cover(t, mapper.topPhotos(t.id, 1)), stories, shares)).toList();
        return new TripPage(page, to < archived.size());
    }

    private MemoryTrip trip(Long userId, TripEntity t, String cover, List<MemoryMapper.StoryRow> stories, List<MemoryMapper.ShareRow> shares) {
        TripSummary s = summaries.get(userId, t.id);
        List<PhotoRow> top = mapper.topPhotos(t.id, MOMENTS);
        List<Moment> moments = top.stream().map(p -> new Moment(p.id, p.imageUrl)).toList();
        MemoryMapper.NoteRow n = mapper.lastNote(t.id);
        List<MemoryMapper.StoryRow> tripStories = stories.stream().filter(v -> t.id.equals(v.tripId)).toList();
        int tripShares = (int) shares.stream().filter(x -> t.id.equals(x.tripId)).count();
        return new MemoryTrip(t.id, t.title, t.destinationName, cityOf(t), t.countryCode, t.status, t.startDate, t.endDate,
                s.days(), s.places(), s.photos(), achievements.countEarned(t.id), cover, moments, Math.max(0, s.photos() - moments.size()),
                n == null ? null : new Note(n.note.trim(), n.placeNameSnapshot),
                tripStories.size(), tripStories.isEmpty() ? null : tripStories.get(0).id, tripShares);
    }

    private List<Creation> creations(List<MemoryMapper.StoryRow> stories, List<MemoryMapper.ShareRow> shares, Map<Long, String> covers) {
        List<Creation> all = new ArrayList<>();
        stories.forEach(v -> {
            String preview = v.coverPhotoId == null ? null : mapper.photoUrl(v.coverPhotoId);
            all.add(new Creation("STORY", v.id, v.tripId, v.tripTitle, v.name, preview != null ? preview : covers.get(v.tripId),
                    v.outputUrl, v.completedAt != null ? v.completedAt : v.updatedAt, v.duration, null));
        });
        shares.forEach(x -> all.add(new Creation("SHARE_LINK", x.id, x.tripId, x.tripTitle, null, covers.get(x.tripId),
                publicUrl + "/s/" + x.shareToken, x.createdAt, null, x.viewCount == null ? 0 : x.viewCount)));
        all.sort(Comparator.comparing(Creation::createdAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return all.stream().limit(12).toList();
    }

    /**
     * 往年今日：先找往年同一天（±3 天）去过的旅行，其次往年同一个月，再次往年同一个季节；
     * 同一类里取最近的一年。都没有时返回 null，前端隐藏整个模块。
     */
    Flashback flashback(List<TripEntity> archived, LocalDate today, Map<Long, String> covers) {
        List<TripEntity> past = archived.stream().filter(t -> t.startDate != null && t.startDate.getYear() < today.getYear()).toList();
        for (String kind : List.of("DAY", "MONTH", "SEASON")) {
            TripEntity best = null;
            int bestYears = Integer.MAX_VALUE;
            for (TripEntity t : past) {
                int years = matchYears(t, today, kind);
                if (years > 0 && years < bestYears) { best = t; bestYears = years; }
            }
            if (best != null) {
                int photos = mapper.countPhotos(best.id);
                List<Moment> moments = mapper.topPhotos(best.id, 4).stream().map(p -> new Moment(p.id, p.imageUrl)).toList();
                return new Flashback(kind, bestYears, best.id, best.title, cityOf(best), best.startDate, best.endDate, covers.get(best.id), photos, moments);
            }
        }
        return null;
    }

    /** 旅行里某一天与今天匹配时返回相隔的年数，否则 0（withYear 会把 2 月 29 日落到平年的 2 月 28 日） */
    static int matchYears(TripEntity t, LocalDate today, String kind) {
        LocalDate end = t.endDate == null ? t.startDate : t.endDate;
        int best = 0;
        for (LocalDate d = t.startDate; !d.isAfter(end) && ChronoUnit.DAYS.between(t.startDate, d) <= 62; d = d.plusDays(1)) {
            int years;
            if ("DAY".equals(kind)) {
                // 找到离今天 ±3 天内的那个周年日（跨年时可能在去年或明年），年数按那个周年日计算
                years = 0;
                for (int y = today.getYear() - 1; y <= today.getYear() + 1; y++) {
                    if (Math.abs(ChronoUnit.DAYS.between(today, d.withYear(y))) <= FLASHBACK_DAYS) years = y - d.getYear();
                }
            } else {
                boolean hit = "MONTH".equals(kind) ? d.getMonthValue() == today.getMonthValue() : season(d.getMonthValue()) == season(today.getMonthValue());
                years = hit ? today.getYear() - d.getYear() : 0;
            }
            if (years > 0 && (best == 0 || years < best)) best = years;
        }
        return best;
    }

    static int season(int month) { return month == 12 || month <= 2 ? 3 : month <= 5 ? 0 : month <= 8 ? 1 : 2; }

    private static String cover(TripEntity t, List<PhotoRow> first) {
        if (t.coverImage != null && !t.coverImage.isBlank()) return t.coverImage;
        return first.isEmpty() ? null : first.get(0).imageUrl;
    }

    private static String cityOf(TripEntity t) {
        return t.city != null && !t.city.isBlank() ? t.city.trim() : t.destinationName;
    }

    private static int clamp(int limit) { return Math.max(1, Math.min(limit <= 0 ? 6 : limit, MAX_PAGE)); }

    private ZoneId zone(Long userId) {
        var u = users.findById(userId);
        try {
            return ZoneId.of(u == null || u.timezone == null ? "UTC" : u.timezone);
        } catch (Exception ex) {
            return ZoneId.of("UTC");
        }
    }
}
