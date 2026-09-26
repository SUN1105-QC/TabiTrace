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
import com.tabitrace.place.dto.PlaceDtos.OfficialRouteView;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OfficialCityService {
    private final OfficialCityMapper cities;private final PlaceMapper places;private final TripService trips;private final TripPlaceMapper tripPlaces;
    public OfficialCityService(OfficialCityMapper cities,PlaceMapper places,TripService trips,TripPlaceMapper tripPlaces){this.cities=cities;this.places=places;this.trips=trips;this.tripPlaces=tripPlaces;}
    public List<OfficialCityView> list(){return cities.listActive().stream().map(this::view).toList();}
    public OfficialCityDetail detail(String code){OfficialCityEntity c=require(code);var ps=places.findOfficialByCity(c.name).stream().map(PlaceService::view).toList();return new OfficialCityDetail(view(c),ps);}
    /** 官方地点，附带每个地点被加入旅行的次数（真实数据，作为探索页的热度） */
    public List<com.tabitrace.place.dto.PlaceDtos.PlaceView> places(String code){OfficialCityEntity c=require(code);
        Map<Long,Integer> counts=new HashMap<>();
        places.tripCounts().forEach(r->counts.put(((Number)r.get("placeId")).longValue(),((Number)r.get("trips")).intValue()));
        return places.findOfficialByCity(c.name).stream().map(p->PlaceService.view(p,counts.getOrDefault(p.id,0))).toList();}
    /** 官方专题路线；只保留仍然存在的地点，顺序与路线一致 */
    public List<OfficialRouteView> routes(String code){OfficialCityEntity c=require(code);
        Set<Long> official=places.findOfficialByCity(c.name).stream().map(p->p.id).collect(Collectors.toSet());
        return cities.routes(c.code).stream().map(r->new OfficialRouteView(r.id,r.code,r.title,r.englishTitle,r.description,r.durationHint,r.season,r.coverImage,
                Arrays.stream(r.placeIds.split(",")).map(String::trim).filter(s->!s.isEmpty()).map(Long::valueOf).filter(official::contains).toList())).toList();}
    @Transactional public com.tabitrace.place.dto.PlaceDtos.PlaceView addToTrip(Long userId,Long tripId,Long placeId){trips.requireWritable(userId,tripId);var p=places.findById(placeId);if(p==null||!"OFFICIAL".equals(p.sourceType))throw new BusinessException("OFFICIAL_PLACE_NOT_FOUND","官方地点不存在",HttpStatus.NOT_FOUND);tripPlaces.add(tripId,placeId,tripPlaces.nextSort(tripId));return PlaceService.view(p);}
    private OfficialCityEntity require(String code){OfficialCityEntity c=cities.findByCode(code.toUpperCase());if(c==null)throw new BusinessException("CITY_NOT_FOUND","官方城市不存在",HttpStatus.NOT_FOUND);return c;}
    private OfficialCityView view(OfficialCityEntity c){return new OfficialCityView(c.id,c.code,c.name,c.countryCode,c.description,c.coverImage,c.theme,places.countOfficialByCity(c.name));}
}
