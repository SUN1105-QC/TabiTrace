package com.tabitrace.place.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public final class PlaceDtos {
    private PlaceDtos() {}
    /**
     * 地点。tagline 起为探索指南内容（仅官方地点有值）：tags 为 MUST / WALK / PHOTO / NIGHT / FREE / RAIN / FOOD / SHOP / NATURE / CULTURE / FIRST；
     * tripCount 为加入过这个地点的旅行数，只在官方城市地点列表里统计。
     */
    public record PlaceView(Long id,String name,String countryCode,String country,String city,String area,String address,BigDecimal latitude,BigDecimal longitude,String category,String sourceType,String description,String coverImage,
                            String tagline,String recommendReason,Integer stayMinutes,String bestTime,List<String> tags,Integer editorRank,Integer tripCount) {}

    /** 官方专题路线：placeIds 为游览顺序 */
    public record OfficialRouteView(Long id,String code,String title,String englishTitle,String description,String durationHint,String season,String coverImage,List<Long> placeIds) {}
    public record AddPlaceRequest(Long placeId,Integer sortOrder) {}
    public record CustomPlaceRequest(@NotBlank @Size(max=200) String name,@Size(max=10) String countryCode,@Size(max=100) String country,@Size(max=100) String city,@Size(max=100) String area,@Size(max=500) String address,BigDecimal latitude,BigDecimal longitude,@Size(max=50) String category,@Size(max=2000) String description,Integer sortOrder) {}
}
