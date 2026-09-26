package com.tabitrace.video.service;

import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.summary.dto.SummaryDtos.TripSummary;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.entity.VideoTemplateEntity;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 把「旅行数据 + 用户设置」自动编排成分镜。
 * 预览接口和开始生成都走这里；生成时结果会冻结到 video_projects.storyboard_json，Worker 只按它渲染。
 */
@Service
public class StoryboardService {
    public static final List<String> MAP_MODES = List.of("OFF", "SIMPLE", "FULL");
    public static final String TAGLINE = "Every Journey · A Better You";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final DateTimeFormatter SHOT_TIME = DateTimeFormatter.ofPattern("MM.dd HH:mm");
    private static final double MIN_COMFORTABLE_SHOT = 0.8;
    private static final double MAX_COMFORTABLE_SHOT = 6.0;

    private final CheckinMapper checkins;
    private final PhotoMapper photos;
    private final VideoCatalogMapper catalog;
    private final SummaryService summaries;
    private final UserMapper users;

    public StoryboardService(CheckinMapper checkins, PhotoMapper photos, VideoCatalogMapper catalog,
                             SummaryService summaries, UserMapper users) {
        this.checkins = checkins;
        this.photos = photos;
        this.catalog = catalog;
        this.summaries = summaries;
        this.users = users;
    }

    /** 画面调色（视觉风格），Worker 在导出时套用对应的 FFmpeg 滤镜 */
    public static final Set<String> VISUAL_STYLES = Set.of("NATURAL", "FRESH", "FILM", "URBAN");

    /** 规范化后的故事设置：所有开关都有确定值。 */
    public record Settings(String title, String endingText, boolean showTitle, boolean showDate, boolean showPlaceNames,
                           boolean showCheckinText, boolean showWeather, boolean showStats, boolean showAchievements,
                           boolean showEnding, String mapMode, List<SegmentOverride> segments, String visualStyle) {
        public StorySettings toDto() {
            return new StorySettings(title, endingText, showTitle, showDate, showPlaceNames, showCheckinText, showWeather,
                    showStats, showAchievements, showEnding, mapMode, segments, visualStyle);
        }
    }

    /** 新前端传 settings；旧前端只传三个布尔值，这里统一成完整设置。 */
    public static Settings normalize(StorySettings s, Boolean legacyText, Boolean legacyMap, Boolean legacyAchievements) {
        if (s == null) {
            boolean map = legacyMap == null || legacyMap;
            return new Settings(null, null, true, true, true, legacyText == null || legacyText, true, true,
                    legacyAchievements == null || legacyAchievements, true, map ? "SIMPLE" : "OFF", List.of(), "NATURAL");
        }
        String mode = s.mapMode() == null ? "SIMPLE" : s.mapMode().trim().toUpperCase(Locale.ROOT);
        String style = s.visualStyle() == null ? "NATURAL" : s.visualStyle().trim().toUpperCase(Locale.ROOT);
        return new Settings(trimToNull(s.title()), trimToNull(s.endingText()), on(s.showTitle()), on(s.showDate()),
                on(s.showPlaceNames()), on(s.showCheckinText()), on(s.showWeather()), on(s.showStats()),
                on(s.showAchievements()), on(s.showEnding()), mode, s.segments() == null ? List.of() : s.segments(),
                VISUAL_STYLES.contains(style) ? style : "NATURAL");
    }

    public static String resolution(String aspectRatio, String quality) {
        boolean hd = "1080p".equals(quality);
        return switch (aspectRatio == null ? "9:16" : aspectRatio) {
            case "4:5" -> hd ? "1080×1350" : "720×900";
            case "16:9" -> hd ? "1920×1080" : "1280×720";
            default -> hd ? "1080×1920" : "720×1280";
        };
    }

    public StoryboardView build(Long userId, TripEntity trip, VideoTemplateEntity template, int duration, String quality,
                                String aspectRatio, Long coverPhotoId, Settings s, List<Long> photoIds) {
        ZoneId zone = zone(userId);
        List<String> notices = new ArrayList<>();
        List<PhotoEntity> ordered = photoIds.stream().map(photos::findById).filter(Objects::nonNull).toList();
        List<CheckinEntity> tripCheckins = checkins.listByTrip(trip.id);
        Map<Long, CheckinEntity> checkinById = new HashMap<>();
        tripCheckins.forEach(c -> checkinById.put(c.id, c));

        String title = s.title() != null ? s.title() : trip.title;
        long days = ChronoUnit.DAYS.between(trip.startDate, trip.endDate) + 1;
        String dateRange = trip.startDate.format(DAY) + " - " + trip.endDate.format(DAY);
        String destination = trip.city != null && !trip.city.isBlank() ? trip.city : trip.destinationName;
        Long coverId = coverPhotoId != null ? coverPhotoId : ordered.isEmpty() ? null : ordered.get(0).id;

        // ── 开场 ──
        Draft opening = new Draft("opening", "OPENING", true, 3.0);
        opening.title = s.showTitle() ? title : "";
        opening.subtitle = s.showDate() ? dateRange : null;
        if (coverId != null) opening.photoIds.add(coverId);
        opening.meta.put("kicker", "MY JOURNEY");
        opening.meta.put("destination", destination);

        // ── 中间段落（可排序 / 关闭 / 改标题）──
        List<Draft> middle = new ArrayList<>();
        Draft map = buildMap(s, tripCheckins, destination, zone, notices);
        if (map != null) middle.add(map);
        middle.addAll(buildPlaces(s, ordered, checkinById, template, zone));
        if (s.showWeather()) notices.add("这趟旅行的打卡还没有天气数据，已自动跳过天气信息");
        if (s.showAchievements()) {
            List<String> earned = catalog.earnedAchievementNames(userId, trip.id);
            if (earned.isEmpty()) {
                notices.add("这趟旅行还没有解锁成就，已跳过成就段落");
            } else {
                Draft a = new Draft("achievements", "ACHIEVEMENTS", false, 3.0);
                a.title = "旅行成就";
                a.subtitle = "解锁 " + earned.size() + " 项成就";
                a.meta.put("items", earned.subList(0, Math.min(6, earned.size())));
                middle.add(a);
            }
        }
        middle = applyOverrides(middle, s.segments());

        // ── 结尾 ──
        Draft ending = null;
        if (s.showEnding()) {
            TripSummary summary = summaries.get(userId, trip.id);
            ending = new Draft("ending", "ENDING", true, 3.0);
            ending.title = title;
            ending.subtitle = days <= 1 ? "1 天" : days + " 天 " + (days - 1) + " 晚";
            if (s.showStats()) ending.meta.put("stats", summary.places() + " 个地点 · " + summary.photos() + " 张照片");
            if (s.endingText() != null) ending.meta.put("endingText", s.endingText());
            ending.meta.put("tagline", TAGLINE);
            Long endingPhoto = ordered.isEmpty() ? coverId : ordered.get(ordered.size() - 1).id;
            if (endingPhoto != null) ending.photoIds.add(endingPhoto);
        } else if (s.showStats()) {
            notices.add("旅行统计显示在结尾页，结尾页关闭后不会出现");
        }
        for (SegmentOverride o : s.segments()) {
            String t = trimToNull(o.title());
            if (t == null) continue;
            if ("opening".equals(o.key())) opening.title = t;
            if ("ending".equals(o.key()) && ending != null) ending.title = t;
        }

        List<Draft> all = new ArrayList<>();
        all.add(opening);
        all.addAll(middle);
        if (ending != null) all.add(ending);

        boolean hasPhotoScene = middle.stream().anyMatch(d -> d.enabled && "PLACE".equals(d.type));
        if (!hasPhotoScene) notices.add("至少要保留一个照片段落才能生成视频");

        List<SceneView> scenes = schedule(all, duration, template, notices);
        return new StoryboardView(duration, template.code, resolution(aspectRatio, quality), !"PRO".equals(trip.planType),
                template.transition, template.transitionSeconds.doubleValue(), scenes, notices, s.visualStyle());
    }

    public static boolean hasPhotoScene(StoryboardView sb) {
        return sb.scenes().stream().anyMatch(sc -> sc.enabled() && "PLACE".equals(sc.type()) && !sc.photoIds().isEmpty());
    }

    // ── 地图路线：按真实打卡时间排序，没有坐标的地点自动跳过，不让整个视频失败 ──
    private Draft buildMap(Settings s, List<CheckinEntity> tripCheckins, String destination, ZoneId zone, List<String> notices) {
        if ("OFF".equals(s.mapMode())) return null;
        List<Map<String, Object>> points = new ArrayList<>();
        int missing = 0;
        String lastName = null;
        for (CheckinEntity c : tripCheckins) {
            if (c.latitude == null || c.longitude == null) { missing++; continue; }
            double lat = c.latitude.doubleValue(), lng = c.longitude.doubleValue();
            if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { missing++; continue; }
            // 同一地点连续打卡多次，只在路线上出现一次
            if (c.placeNameSnapshot != null && c.placeNameSnapshot.equals(lastName)) continue;
            lastName = c.placeNameSnapshot;
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("name", c.placeNameSnapshot);
            p.put("area", c.areaSnapshot);
            p.put("lat", lat);
            p.put("lng", lng);
            p.put("time", local(c.checkinTime, zone).format(SHOT_TIME));
            points.add(p);
        }
        if (points.size() < 2) {
            notices.add(points.isEmpty() ? "打卡还没有坐标，已跳过地图路线动画" : "只有 1 个打卡有坐标，路线动画至少需要 2 个地点，已跳过");
            return null;
        }
        if (missing > 0) notices.add(missing + " 个打卡没有坐标，路线中已跳过这些地点");
        boolean full = "FULL".equals(s.mapMode());
        Draft d = new Draft("map", "MAP", false, full ? 1.2 + 0.6 * Math.min(points.size(), 8) : 3.0);
        d.title = destination + " 路线";
        d.subtitle = points.size() + " 个地点";
        d.meta.put("mode", s.mapMode());
        d.meta.put("points", points);
        return d;
    }

    // ── 照片段落：照片顺序即镜头顺序，同一次打卡的相邻照片合成一段 ──
    private List<Draft> buildPlaces(Settings s, List<PhotoEntity> ordered, Map<Long, CheckinEntity> checkinById,
                                    VideoTemplateEntity template, ZoneId zone) {
        double shot = switch (template.pace == null ? "MEDIUM" : template.pace) {
            case "SLOW" -> 2.4;
            case "FAST" -> 1.3;
            default -> 1.9;
        };
        List<Draft> out = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();
        Draft current = null;
        Long currentCheckin = null;
        int moments = 0;
        for (PhotoEntity p : ordered) {
            CheckinEntity c = p.checkinId == null ? null : checkinById.get(p.checkinId);
            Long cid = c == null ? null : c.id;
            if (current == null || !Objects.equals(cid, currentCheckin)) {
                String key = c != null ? "place-" + c.id : "moments-" + (++moments);
                String unique = key;
                for (int n = 2; usedKeys.contains(unique); n++) unique = key + "-" + n;
                usedKeys.add(unique);
                current = new Draft(unique, "PLACE", false, 0);
                if (c != null) {
                    current.title = s.showPlaceNames() ? c.placeNameSnapshot : "旅途片段";
                    List<String> sub = new ArrayList<>();
                    if (s.showDate()) sub.add(local(c.checkinTime, zone).format(SHOT_TIME));
                    if (s.showPlaceNames() && c.areaSnapshot != null && !c.areaSnapshot.isBlank()) sub.add(c.areaSnapshot);
                    current.subtitle = sub.isEmpty() ? null : String.join(" · ", sub);
                    current.meta.put("checkinId", c.id);
                    current.meta.put("placeName", c.placeNameSnapshot);
                    if (s.showCheckinText() && c.note != null && !c.note.isBlank()) current.meta.put("note", c.note.trim());
                } else {
                    current.title = "旅途瞬间";
                    LocalDateTime when = p.capturedAt != null ? p.capturedAt : p.createdAt;
                    current.subtitle = s.showDate() && when != null ? local(when, zone).format(SHOT_TIME) : null;
                }
                out.add(current);
                currentCheckin = cid;
            }
            current.photoIds.add(p.id);
            current.weight += shot;
        }
        return out;
    }

    /** 覆盖里的段落按其顺序排在前面，其余按自然顺序追加；已不存在的 key 自动忽略。 */
    private static List<Draft> applyOverrides(List<Draft> natural, List<SegmentOverride> overrides) {
        if (overrides == null || overrides.isEmpty()) return natural;
        Map<String, Draft> byKey = new LinkedHashMap<>();
        natural.forEach(d -> byKey.put(d.key, d));
        List<Draft> out = new ArrayList<>();
        for (SegmentOverride o : overrides) {
            Draft d = byKey.remove(o.key());
            if (d == null) continue;
            if (Boolean.FALSE.equals(o.enabled())) d.enabled = false;
            String t = trimToNull(o.title());
            if (t != null) d.title = t;
            out.add(d);
        }
        out.addAll(byKey.values());
        return out;
    }

    /** 按权重把总时长分给启用的段落，保证总和严格等于用户选择的时长。 */
    private static List<SceneView> schedule(List<Draft> all, int duration, VideoTemplateEntity template, List<String> notices) {
        double totalWeight = all.stream().filter(d -> d.enabled).mapToDouble(d -> d.weight).sum();
        double factor = totalWeight <= 0 ? 0 : duration / totalWeight;
        List<Draft> enabled = all.stream().filter(d -> d.enabled && d.weight > 0).toList();
        double used = 0;
        for (int i = 0; i < enabled.size(); i++) {
            Draft d = enabled.get(i);
            d.seconds = i == enabled.size() - 1 ? round(duration - used) : round(d.weight * factor);
            used += d.seconds;
        }

        double shotSeconds = -1;
        List<SceneView> out = new ArrayList<>();
        double cursor = 0;
        for (Draft d : all) {
            boolean active = d.enabled && d.weight > 0;
            double seconds = active ? d.seconds : 0;
            if (active && "PLACE".equals(d.type) && !d.photoIds.isEmpty()) {
                double each = round(seconds / d.photoIds.size());
                List<Double> shots = new ArrayList<>(Collections.nCopies(d.photoIds.size(), each));
                shots.set(shots.size() - 1, round(seconds - each * (shots.size() - 1)));
                d.meta.put("shots", shots);
                shotSeconds = shotSeconds < 0 ? each : Math.min(shotSeconds, each);
            }
            out.add(new SceneView(d.key, d.type, d.title, d.subtitle, round(cursor), seconds, List.copyOf(d.photoIds),
                    d.enabled, d.pinned, d.meta));
            cursor += seconds;
        }
        if (shotSeconds > 0 && shotSeconds < MIN_COMFORTABLE_SHOT) {
            notices.add(String.format(Locale.ROOT, "照片较多，每张约 %.1f 秒，画面会切得很快；可以减少照片或选择更长的时长", shotSeconds));
        } else if (shotSeconds > MAX_COMFORTABLE_SHOT) {
            notices.add(String.format(Locale.ROOT, "照片较少，每张约 %.1f 秒；多选几张会让故事更丰富", shotSeconds));
        }
        double transition = template.transitionSeconds == null ? 0.5 : template.transitionSeconds.doubleValue();
        if (shotSeconds > 0 && shotSeconds < transition * 2) {
            notices.add("单张照片停留时间短于转场，生成时会自动缩短转场");
        }
        return out;
    }

    private ZoneId zone(Long userId) {
        var u = users.findById(userId);
        try {
            return ZoneId.of(u == null || u.timezone == null ? "UTC" : u.timezone);
        } catch (Exception ex) {
            return ZoneId.of("UTC");
        }
    }

    private static LocalDateTime local(LocalDateTime utc, ZoneId zone) {
        return utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDateTime();
    }

    private static boolean on(Boolean b) { return b == null || b; }

    private static String trimToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }

    private static final class Draft {
        final String key, type;
        final boolean pinned;
        final List<Long> photoIds = new ArrayList<>();
        final Map<String, Object> meta = new LinkedHashMap<>();
        String title = "", subtitle;
        boolean enabled = true;
        double weight, seconds;

        Draft(String key, String type, boolean pinned, double weight) {
            this.key = key;
            this.type = type;
            this.pinned = pinned;
            this.weight = weight;
        }
    }
}
