package com.tabitrace.destination.dto;

import java.math.BigDecimal;

public final class DestinationDtos {
    private DestinationDtos() {}
    /** 目的地的官方探索内容：只有 official_cities 中处于 ACTIVE 的城市才有；数量均为实时统计 */
    public record OfficialGuide(String code, String name, int placeCount, int routeCount, String coverImage) {}
    public record DestinationView(Long id, String name, String nameEn, String countryCode, String countryName,
                                  BigDecimal latitude, BigDecimal longitude, String timezone, String coverImage, OfficialGuide official) {}
}
