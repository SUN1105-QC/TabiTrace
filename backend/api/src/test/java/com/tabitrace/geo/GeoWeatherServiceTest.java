package com.tabitrace.geo;

import com.sun.net.httpserver.HttpServer;
import com.tabitrace.geo.dto.GeoDtos.ReverseResult;
import com.tabitrace.geo.dto.GeoDtos.WeatherSnapshot;
import com.tabitrace.geo.service.GeoService;
import com.tabitrace.geo.service.WeatherService;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 用本地 HTTP 服务模拟 Open-Meteo / Nominatim：不访问外网，覆盖成功、失败与「不拿预报冒充实况」 */
class GeoWeatherServiceTest {
    private HttpServer server;
    private final List<String> requests = new ArrayList<>();
    private volatile int status = 200;
    private volatile String body = "{}";
    private final AtomicInteger calls = new AtomicInteger();
    private static final BigDecimal LAT = new BigDecimal("35.7148"), LNG = new BigDecimal("139.7967");

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            calls.incrementAndGet();
            requests.add(ex.getRequestURI().toString() + " UA=" + ex.getRequestHeaders().getFirst("User-Agent"));
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(status, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() { server.stop(0); }

    private String base() { return "http://127.0.0.1:" + server.getAddress().getPort(); }
    private WeatherService weather() { return new WeatherService(JsonMapper.builder().build(), true, base()); }

    @Test
    void currentWeatherUsesObservationTime() {
        body = "{\"current\":{\"time\":\"2026-09-29T13:15\",\"interval\":900,\"temperature_2m\":18.7,\"weather_code\":61}}";
        WeatherSnapshot w = weather().at(LAT, LNG, Instant.now().minusSeconds(60));
        assertNotNull(w);
        assertEquals(61, w.code());
        assertEquals("小雨", w.text());
        assertEquals(new BigDecimal("18.7"), w.temperatureC());
        assertEquals("2026-09-29T13:15Z", w.observedAt().toString());
        assertTrue(requests.get(0).contains("current=temperature_2m,weather_code"));
    }

    @Test
    void pastCheckinUsesThatHourNotTheCurrentWeather() {
        // 5 小时前的打卡：取那个整点（四舍五入到最近整点）的历史值，而不是现在的天气
        Instant when = Instant.now().minus(Duration.ofHours(5));
        String hour = java.time.LocalDateTime.ofInstant(when.plus(Duration.ofMinutes(30)).truncatedTo(java.time.temporal.ChronoUnit.HOURS), java.time.ZoneOffset.UTC)
            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
        body = "{\"hourly\":{\"time\":[\"" + hour + "\"],\"temperature_2m\":[21.4],\"weather_code\":[1]}}";
        WeatherSnapshot w = weather().at(LAT, LNG, when);
        assertNotNull(w);
        assertEquals("晴间多云", w.text());
        assertEquals(new BigDecimal("21.4"), w.temperatureC());
        assertEquals(hour + "Z", w.observedAt().toString());
        assertTrue(requests.get(0).contains("hourly=temperature_2m,weather_code"));
        assertTrue(requests.get(0).contains("start_hour=" + hour));
        assertFalse(requests.get(0).contains("current="));
        // 返回的整点对不上时不采用
        requests.clear();
        body = "{\"hourly\":{\"time\":[\"2000-01-01T00:00\"],\"temperature_2m\":[21.4],\"weather_code\":[1]}}";
        assertNull(weather().at(LAT, LNG, when.minus(Duration.ofHours(3))));
    }

    @Test
    void futureOrInvalidOrFailingGivesNoWeather() {
        body = "{\"current\":{\"time\":\"2026-09-29T13:15\",\"temperature_2m\":18.7,\"weather_code\":0}}";
        assertNull(weather().at(LAT, LNG, Instant.now().plus(Duration.ofHours(3))), "未来时刻不能用预报冒充");
        assertNull(weather().at(new BigDecimal("95"), LNG, Instant.now()), "非法坐标");
        assertNull(weather().at(null, LNG, Instant.now()), "没有坐标");
        assertEquals(0, calls.get(), "以上情况都不应请求天气服务");
        status = 500;
        assertNull(weather().at(LAT, LNG, Instant.now()), "服务报错时返回空，不编造");
        status = 200;
        body = "{\"current\":{\"time\":\"2026-09-29T13:15\"}}";
        assertNull(weather().at(LAT, LNG, Instant.now()), "缺少数值时返回空");
        assertNull(new WeatherService(JsonMapper.builder().build(), false, base()).at(LAT, LNG, Instant.now()), "关闭时不请求");
    }

    @Test
    void reverseGeocodeGivesNeighbourhoodNotAShop() {
        body = "{\"name\":\"\",\"address\":{\"neighbourhood\":\"浅草二丁目\",\"quarter\":\"浅草\",\"city\":\"臺東區\",\"country\":\"日本\",\"country_code\":\"jp\"}}";
        PlaceMapper places = mock(PlaceMapper.class);
        GeoService geo = new GeoService(JsonMapper.builder().build(), places, true, base(), "TabiTrace-test/1.0");
        ReverseResult r = geo.reverse(LAT, LNG, null, null);
        assertNotNull(r);
        assertEquals("浅草附近", r.placeName());
        assertEquals("臺東區", r.area());
        assertEquals("浅草 · 臺東區", r.label());
        assertEquals("JP", r.countryCode());
        assertNull(r.nearPlaceId(), "精度未知时不给附近地点");
        assertTrue(requests.get(0).contains("zoom=16"));
        assertTrue(requests.get(0).contains("UA=TabiTrace-test/1.0"), "Nominatim 要求可识别的 User-Agent");
        // 同一网格第二次命中缓存
        geo.reverse(LAT, LNG, null, null);
        assertEquals(1, calls.get());
    }

    @Test
    void nearbyPlaceOnlyWhenAccurateAndClose() {
        body = "{\"address\":{\"quarter\":\"浅草\",\"city\":\"臺東區\",\"country\":\"日本\",\"country_code\":\"jp\"}}";
        PlaceEntity temple = new PlaceEntity();
        temple.id = 7L; temple.name = "浅草寺"; temple.latitude = new BigDecimal("35.7150"); temple.longitude = new BigDecimal("139.7968"); // 约 24 米
        PlaceEntity far = new PlaceEntity();
        far.id = 8L; far.name = "雷门"; far.latitude = new BigDecimal("35.7110"); far.longitude = new BigDecimal("139.7963"); // 约 400 米
        PlaceMapper places = mock(PlaceMapper.class);
        when(places.findOfficialNear(anyDouble(), anyDouble())).thenReturn(List.of(far, temple));
        when(places.findByTrip(anyLong())).thenReturn(List.of());
        GeoService geo = new GeoService(JsonMapper.builder().build(), places, true, base(), "t");
        ReverseResult precise = geo.reverse(LAT, LNG, 20, 11L);
        assertEquals(7L, precise.nearPlaceId());
        assertEquals("浅草寺", precise.nearPlaceName());
        assertTrue(precise.nearPlaceDistanceM() < 60);
        assertEquals("浅草附近", precise.placeName(), "附近地点只是提示，地点名仍是街区级");
        ReverseResult rough = geo.reverse(LAT, LNG, 300, 11L);
        assertNull(rough.nearPlaceId(), "定位精度差时不认定附近地点");
    }

    @Test
    void reverseGeocodeFailureGivesNull() {
        status = 503;
        GeoService geo = new GeoService(JsonMapper.builder().build(), mock(PlaceMapper.class), true, base(), "t");
        assertNull(geo.reverse(LAT, LNG, null, null));
        assertNull(geo.reverse(null, LNG, null, null));
    }
}
