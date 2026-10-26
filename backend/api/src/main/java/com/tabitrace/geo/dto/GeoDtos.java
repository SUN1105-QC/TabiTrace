package com.tabitrace.geo.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class GeoDtos {
    private GeoDtos() {}

    /**
     * 逆地理编码结果（只到街区 / 行政区级别，不猜具体店铺）。
     * placeName：打卡记录用的地点名，例如「浅草附近」；area：行政区，例如「臺東區」；label：界面展示用的一行文字。
     * nearPlace*：定位精度足够时，附近 60 米内这段旅行 / 官方目录里的地点，只作为提示，不自动认定用户在那里打卡。
     */
    public record ReverseResult(String label, String placeName, String area, String city, String country, String countryCode,
                                Long nearPlaceId, String nearPlaceName, Integer nearPlaceDistanceM, String source) {}

    /** 某个时刻、某个坐标的天气快照；observedAt 是数据对应的时刻（不是请求时刻），拿不到时整个结果为 null */
    public record WeatherSnapshot(Integer code, String text, BigDecimal temperatureC, OffsetDateTime observedAt, String source) {}
}
