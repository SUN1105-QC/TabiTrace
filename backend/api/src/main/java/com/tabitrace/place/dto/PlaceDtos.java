package com.tabitrace.place.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public final class PlaceDtos {
    private PlaceDtos() {}
    public record PlaceView(Long id,String name,String countryCode,String country,String city,String area,String address,BigDecimal latitude,BigDecimal longitude,String category,String sourceType,String description,String coverImage) {}
    public record AddPlaceRequest(Long placeId,Integer sortOrder) {}
    public record CustomPlaceRequest(@NotBlank @Size(max=200) String name,@Size(max=10) String countryCode,@Size(max=100) String country,@Size(max=100) String city,@Size(max=100) String area,@Size(max=500) String address,BigDecimal latitude,BigDecimal longitude,@Size(max=50) String category,@Size(max=2000) String description,Integer sortOrder) {}
}
