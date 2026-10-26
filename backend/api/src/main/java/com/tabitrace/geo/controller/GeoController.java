package com.tabitrace.geo.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.geo.dto.GeoDtos.ReverseResult;
import com.tabitrace.geo.dto.GeoDtos.WeatherSnapshot;
import com.tabitrace.geo.service.GeoService;
import com.tabitrace.geo.service.WeatherService;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.trip.service.TripService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * 快速打卡的自动信息：坐标 → 街区级地点、坐标 + 时刻 → 天气。需要登录；拿不到结果时 data 为空（不是错误），
 * 前端显示「位置暂未获取 / 天气暂未获取」，不影响保存。
 */
@RestController
@RequestMapping("/api/v1/geo")
public class GeoController {
    private final GeoService geo; private final WeatherService weather; private final TripService trips;
    public GeoController(GeoService geo, WeatherService weather, TripService trips) { this.geo = geo; this.weather = weather; this.trips = trips; }

    @GetMapping("/reverse")
    public ApiResponse<ReverseResult> reverse(@RequestParam BigDecimal lat, @RequestParam BigDecimal lng,
                                              @RequestParam(required = false) Integer accuracy, @RequestParam(required = false) Long tripId) {
        Long userId = SecurityUtils.currentUser().id();
        // 附近地点提示会用到这段旅行的自定义地点：只允许查询自己的旅行
        if (tripId != null) trips.requireOwned(userId, tripId);
        return ApiResponse.ok(geo.reverse(lat, lng, accuracy, tripId));
    }

    @GetMapping("/weather")
    public ApiResponse<WeatherSnapshot> weather(@RequestParam BigDecimal lat, @RequestParam BigDecimal lng,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime at) {
        SecurityUtils.currentUser();
        return ApiResponse.ok(weather.at(lat, lng, at == null ? Instant.now() : at.toInstant()));
    }
}
