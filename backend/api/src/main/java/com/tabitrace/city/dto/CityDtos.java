package com.tabitrace.city.dto;

import com.tabitrace.place.dto.PlaceDtos.PlaceView;
import java.util.List;

public final class CityDtos {
    private CityDtos() {}
    public record OfficialCityView(Long id,String code,String name,String countryCode,String description,String coverImage,String theme,int placeCount) {}
    public record OfficialCityDetail(OfficialCityView city,List<PlaceView> places) {}
}
