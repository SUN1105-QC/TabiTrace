package com.tabitrace.geo.service;

import com.tabitrace.geo.dto.GeoDtos.ReverseResult;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 逆地理编码（OpenStreetMap Nominatim）：坐标 → 「浅草 · 臺東區」这样的街区级地点。
 * - 只取到街区 / 行政区，不把坐标认定成某家店或某个景点（zoom=16）
 * - 定位精度足够（≤ 50 米）时，另外给出 60 米内这段旅行或官方目录里的地点作为提示，由用户自己决定是否采用
 * - 遵守 Nominatim 使用规范：带可识别的 User-Agent、全局每秒最多 1 次请求，结果按约 11 米网格缓存 24 小时
 * 失败返回 null（调用方显示「位置暂未获取」），不影响打卡保存。
 */
@Service
public class GeoService {
    private static final Logger log = LoggerFactory.getLogger(GeoService.class);
    static final int NEAR_RADIUS_M = 60, NEAR_MAX_ACCURACY_M = 50;

    private final ObjectMapper json;
    private final PlaceMapper places;
    private final boolean enabled;
    private final String baseUrl, userAgent;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final Map<String, Cached> cache = java.util.Collections.synchronizedMap(new LinkedHashMap<>(256, .75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Cached> e) { return size() > 3000; }
    });
    private record Cached(Address value, Instant expires) {}
    /** Nominatim 解析出的街区信息（与旅行无关，可跨用户缓存） */
    record Address(String local, String city, String country, String countryCode) {}
    private long lastCall = 0;

    public GeoService(ObjectMapper json, PlaceMapper places,
                      @Value("${app.geo.enabled:true}") boolean enabled,
                      @Value("${app.geo.nominatim-url:https://nominatim.openstreetmap.org}") String baseUrl,
                      @Value("${app.geo.user-agent:TabiTrace/1.0 (travel journal; contact: support@tabitrace.local)}") String userAgent) {
        this.json = json;
        this.places = places;
        this.enabled = enabled;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.userAgent = userAgent;
    }

    public static boolean validCoords(BigDecimal lat, BigDecimal lng) {
        return lat != null && lng != null && lat.abs().compareTo(BigDecimal.valueOf(90)) <= 0 && lng.abs().compareTo(BigDecimal.valueOf(180)) <= 0;
    }

    /** tripId 可为空；accuracyM 为浏览器给出的定位精度（米），为空视为精度未知（不做附近地点提示） */
    public ReverseResult reverse(BigDecimal lat, BigDecimal lng, Integer accuracyM, Long tripId) {
        if (!validCoords(lat, lng)) return null;
        Address a = enabled ? address(lat, lng) : null;
        PlaceEntity near = null; int nearDist = 0;
        if (accuracyM != null && accuracyM <= NEAR_MAX_ACCURACY_M) {
            List<PlaceEntity> candidates = new ArrayList<>();
            if (tripId != null) candidates.addAll(places.findByTrip(tripId));
            candidates.addAll(places.findOfficialNear(lat.doubleValue(), lng.doubleValue()));
            for (PlaceEntity p : candidates) {
                if (p.latitude == null || p.longitude == null) continue;
                int d = (int) Math.round(distanceM(lat.doubleValue(), lng.doubleValue(), p.latitude.doubleValue(), p.longitude.doubleValue()));
                if (d <= NEAR_RADIUS_M && (near == null || d < nearDist)) { near = p; nearDist = d; }
            }
        }
        if (a == null && near == null) return null;
        String local = a != null ? a.local() : null;
        String city = a != null ? a.city() : (near.area != null ? near.area : near.city);
        String placeName = local != null ? local + "附近" : near != null ? near.name + "附近" : null;
        String label = String.join(" · ", java.util.stream.Stream.of(local, city).filter(s -> s != null && !s.isBlank()).distinct().toList());
        if (label.isBlank()) label = placeName;
        return new ReverseResult(label, placeName, city, city, a != null ? a.country() : null, a != null ? a.countryCode() : null,
                near == null ? null : near.id, near == null ? null : near.name, near == null ? null : nearDist, a != null ? "osm-nominatim" : "tabitrace-places");
    }

    private Address address(BigDecimal lat, BigDecimal lng) {
        String la = lat.setScale(4, RoundingMode.HALF_UP).toPlainString(), lo = lng.setScale(4, RoundingMode.HALF_UP).toPlainString();
        String key = la + "," + lo;
        Instant now = Instant.now();
        Cached hit = cache.get(key);
        if (hit != null && hit.expires().isAfter(now)) return hit.value();
        JsonNode root = fetch(la, lo);
        if (root == null || root.has("error")) return null;
        JsonNode ad = root.path("address");
        String local = first(ad, "quarter", "suburb", "neighbourhood", "city_district", "town", "village", "hamlet");
        String city = first(ad, "city", "town", "county", "state", "province");
        if (local != null && local.equals(city)) local = null;
        if (local == null && city == null) return null;
        Address a = new Address(local != null ? local : city, city, text(ad, "country"), text(ad, "country_code") == null ? null : text(ad, "country_code").toUpperCase());
        cache.put(key, new Cached(a, now.plus(Duration.ofHours(24))));
        return a;
    }

    private JsonNode fetch(String lat, String lng) {
        try {
            synchronized (this) {
                long wait = lastCall + 1100 - System.currentTimeMillis();
                if (wait > 0) Thread.sleep(wait);
                lastCall = System.currentTimeMillis();
            }
            String url = baseUrl + "/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=" + lat + "&lon=" + lng
                + "&accept-language=" + URLEncoder.encode("zh-CN,zh,ja,en", StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).header("User-Agent", userAgent).header("Accept", "application/json").GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) { log.warn("逆地理编码服务返回 {}", res.statusCode()); return null; }
            return json.readTree(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            log.warn("逆地理编码服务不可用：{}", e.getMessage());
            return null;
        }
    }

    private static String first(JsonNode ad, String... keys) {
        for (String k : keys) { String v = text(ad, k); if (v != null) return v; }
        return null;
    }
    private static String text(JsonNode n, String k) {
        JsonNode v = n.path(k);
        if (v.isMissingNode() || v.isNull()) return null;
        String s = v.asString("").trim();
        return s.isEmpty() ? null : s;
    }

    /** 球面距离（米） */
    static double distanceM(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371000, dLat = Math.toRadians(lat2 - lat1), dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
    }
}
