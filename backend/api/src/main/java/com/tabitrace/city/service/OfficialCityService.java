package com.tabitrace.city.service;

import com.tabitrace.city.dto.CityDtos.*;
import com.tabitrace.city.entity.OfficialCityEntity;
import com.tabitrace.city.mapper.OfficialCityMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.service.PlaceService;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class OfficialCityService {
    private final OfficialCityMapper cities;private final PlaceMapper places;private final TripService trips;private final TripPlaceMapper tripPlaces;
    public OfficialCityService(OfficialCityMapper cities,PlaceMapper places,TripService trips,TripPlaceMapper tripPlaces){this.cities=cities;this.places=places;this.trips=trips;this.tripPlaces=tripPlaces;}
    public List<OfficialCityView> list(){return cities.listActive().stream().map(this::view).toList();}
    public OfficialCityDetail detail(String code){OfficialCityEntity c=require(code);var ps=places.findOfficialByCity(c.name).stream().map(PlaceService::view).toList();return new OfficialCityDetail(view(c),ps);}
    public List<com.tabitrace.place.dto.PlaceDtos.PlaceView> places(String code){OfficialCityEntity c=require(code);return places.findOfficialByCity(c.name).stream().map(PlaceService::view).toList();}
    @Transactional public com.tabitrace.place.dto.PlaceDtos.PlaceView addToTrip(Long userId,Long tripId,Long placeId){trips.requireWritable(userId,tripId);var p=places.findById(placeId);if(p==null||!"OFFICIAL".equals(p.sourceType))throw new BusinessException("OFFICIAL_PLACE_NOT_FOUND","官方地点不存在",HttpStatus.NOT_FOUND);tripPlaces.add(tripId,placeId,tripPlaces.nextSort(tripId));return PlaceService.view(p);}
    private OfficialCityEntity require(String code){OfficialCityEntity c=cities.findByCode(code.toUpperCase());if(c==null)throw new BusinessException("CITY_NOT_FOUND","官方城市不存在",HttpStatus.NOT_FOUND);return c;}
    private OfficialCityView view(OfficialCityEntity c){return new OfficialCityView(c.id,c.code,c.name,c.countryCode,c.description,c.coverImage,c.theme,places.countOfficialByCity(c.name));}
}
