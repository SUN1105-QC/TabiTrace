package com.tabitrace.geo.service;

import com.tabitrace.geo.dto.GeoDtos.WeatherSnapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 打卡天气（Open-Meteo，免费、无需密钥）。
 * - 打卡时刻在 90 分钟以内：取「当前观测」（15 分钟粒度的模型实况），observedAt 是数据自己的时刻
 * - 更早的时刻（92 天内）：取那个整点的历史逐小时数据
 * - 未来时刻或更久以前：不取，返回 null —— 绝不拿几小时后的预报冒充当时的天气
 * 任何失败都返回 null，由调用方显示「天气暂未获取」，不影响保存。结果按坐标（约 1 公里）+ 时间段缓存。
 */
@Service
public class WeatherService {
    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
    private static final Duration CURRENT_WINDOW = Duration.ofMinutes(90);
    private static final Duration PAST_LIMIT = Duration.ofDays(92);

    private final ObjectMapper json;
    private final boolean enabled;
    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();
    private record Cached(WeatherSnapshot value, Instant expires) {}

    public WeatherService(ObjectMapper json,
                          @Value("${app.weather.enabled:true}") boolean enabled,
                          @Value("${app.weather.base-url:https://api.open-meteo.com}") String baseUrl) {
        this.json = json;
        this.enabled = enabled;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    public WeatherSnapshot at(BigDecimal lat, BigDecimal lng, Instant when) {
        if (!enabled || !GeoService.validCoords(lat, lng) || when == null) return null;
        Instant now = Instant.now();
        if (when.isAfter(now.plus(Duration.ofMinutes(15)))) return null;
        Duration age = Duration.between(when, now);
        if (age.compareTo(PAST_LIMIT) > 0) return null;
        boolean current = age.compareTo(CURRENT_WINDOW) <= 0;
        String la = lat.setScale(2, RoundingMode.HALF_UP).toPlainString(), lo = lng.setScale(2, RoundingMode.HALF_UP).toPlainString();
        LocalDateTime hour = LocalDateTime.ofInstant(when.plus(Duration.ofMinutes(30)).truncatedTo(ChronoUnit.HOURS), ZoneOffset.UTC);
        String key = current ? la + "," + lo + "@now" + now.getEpochSecond() / 900 : la + "," + lo + "@" + hour;
        Cached hit = cache.get(key);
        if (hit != null && hit.expires().isAfter(now)) return hit.value();
        WeatherSnapshot result = current ? fetchCurrent(la, lo) : fetchHour(la, lo, hour);
        if (result != null) {
            if (cache.size() > 5000) cache.clear();
            cache.put(key, new Cached(result, now.plus(current ? Duration.ofMinutes(15) : Duration.ofHours(12))));
        }
        return result;
    }

    private WeatherSnapshot fetchCurrent(String lat, String lng) {
        JsonNode root = get("/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=temperature_2m,weather_code&timezone=UTC");
        JsonNode c = root == null ? null : root.path("current");
        if (c == null || c.isMissingNode() || !c.hasNonNull("weather_code") || !c.hasNonNull("temperature_2m")) return null;
        return snapshot(c.path("weather_code").asInt(), c.path("temperature_2m").asDouble(), c.path("time").asString(""));
    }

    private WeatherSnapshot fetchHour(String lat, String lng, LocalDateTime hour) {
        String h = hour.format(HOUR);
        JsonNode root = get("/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&hourly=temperature_2m,weather_code&timezone=UTC&start_hour=" + h + "&end_hour=" + h);
        JsonNode hourly = root == null ? null : root.path("hourly");
        if (hourly == null || hourly.isMissingNode()) return null;
        JsonNode times = hourly.path("time"), codes = hourly.path("weather_code"), temps = hourly.path("temperature_2m");
        for (int i = 0; i < times.size(); i++) {
            if (!h.equals(times.get(i).asString("")) || codes.get(i) == null || codes.get(i).isNull() || temps.get(i) == null || temps.get(i).isNull()) continue;
            return snapshot(codes.get(i).asInt(), temps.get(i).asDouble(), h);
        }
        return null;
    }

    private JsonNode get(String path) {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(5)).header("Accept", "application/json").GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) { log.warn("天气服务返回 {}", res.statusCode()); return null; }
            return json.readTree(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            log.warn("天气服务不可用：{}", e.getMessage());
            return null;
        }
    }

    private static WeatherSnapshot snapshot(int code, double temp, String utcTime) {
        java.time.OffsetDateTime observed;
        try { observed = LocalDateTime.parse(utcTime).atOffset(ZoneOffset.UTC); } catch (Exception e) { return null; }
        return new WeatherSnapshot(code, describe(code), BigDecimal.valueOf(temp).setScale(1, RoundingMode.HALF_UP), observed, "open-meteo");
    }

    /** WMO 天气代码 → 简短中文 */
    public static String describe(int code) {
        return switch (code) {
            case 0 -> "晴";
            case 1 -> "晴间多云";
            case 2 -> "多云";
            case 3 -> "阴";
            case 45, 48 -> "雾";
            case 51, 53, 55, 56, 57 -> "毛毛雨";
            case 61, 80 -> "小雨";
            case 63, 81 -> "中雨";
            case 65, 82 -> "大雨";
            case 66, 67 -> "冻雨";
            case 71, 85 -> "小雪";
            case 73 -> "中雪";
            case 75, 86 -> "大雪";
            case 77 -> "米雪";
            case 95 -> "雷阵雨";
            case 96, 99 -> "雷阵雨伴冰雹";
            default -> "未知";
        };
    }
}
