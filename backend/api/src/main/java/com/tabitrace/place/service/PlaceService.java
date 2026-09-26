package com.tabitrace.place.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.place.dto.PlaceDtos.*;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class PlaceService {
    private final PlaceMapper mapper; private final TripPlaceMapper tripPlaces; private final TripService trips;
    public PlaceService(PlaceMapper mapper,TripPlaceMapper tripPlaces,TripService trips){this.mapper=mapper;this.tripPlaces=tripPlaces;this.trips=trips;}
    public List<PlaceView> listTrip(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.findByTrip(tripId).stream().map(PlaceService::view).toList();}
    public List<PlaceView> search(String q){if(q==null||q.isBlank())return List.of();return mapper.search(q.trim()).stream().map(PlaceService::view).toList();}
    public PlaceView get(Long id){PlaceEntity p=mapper.findById(id);if(p==null||!"OFFICIAL".equals(p.sourceType))throw new BusinessException("PLACE_NOT_FOUND","地点不存在",HttpStatus.NOT_FOUND);return view(p);}
    @Transactional public PlaceView addExisting(Long userId,Long tripId,Long placeId,Integer sort){trips.requireWritable(userId,tripId);PlaceEntity p=mapper.findById(placeId);if(p==null)throw new BusinessException("PLACE_NOT_FOUND","地点不存在",HttpStatus.NOT_FOUND);if("CUSTOM".equals(p.sourceType)&&tripPlaces.exists(tripId,placeId)==0)throw new BusinessException("CUSTOM_PLACE_FORBIDDEN","自定义地点只能在创建它的旅行中使用",HttpStatus.FORBIDDEN);tripPlaces.add(tripId,placeId,sort==null?tripPlaces.nextSort(tripId):sort);return view(p);}
    @Transactional public PlaceView addCustom(Long userId,Long tripId,CustomPlaceRequest r){var trip=trips.requireWritable(userId,tripId);PlaceEntity p=new PlaceEntity();p.name=r.name().trim();p.countryCode=blank(r.countryCode());p.country=blank(r.country());p.city=blank(r.city())==null?trip.city:blank(r.city());p.area=blank(r.area());p.address=blank(r.address());p.latitude=r.latitude();p.longitude=r.longitude();p.category=blank(r.category());p.sourceType="CUSTOM";p.description=blank(r.description());mapper.insert(p);tripPlaces.add(tripId,p.id,r.sortOrder()==null?tripPlaces.nextSort(tripId):r.sortOrder());return view(p);}
    /** 收藏：只能收藏官方地点，重复收藏 / 取消都是幂等的 */
    public List<Long> favorites(Long userId){return mapper.favoriteIds(userId);}
    public void favorite(Long userId,Long placeId,boolean on){get(placeId);if(on)mapper.addFavorite(userId,placeId);else mapper.removeFavorite(userId,placeId);}
    @Transactional public void remove(Long userId,Long tripId,Long placeId){trips.requireWritable(userId,tripId);tripPlaces.remove(tripId,placeId);}
    public void requireUsableInTrip(Long tripId,Long placeId){PlaceEntity p=mapper.findById(placeId);if(p==null)throw new BusinessException("PLACE_NOT_FOUND","地点不存在",HttpStatus.NOT_FOUND);if("CUSTOM".equals(p.sourceType)&&tripPlaces.exists(tripId,placeId)==0)throw new BusinessException("CUSTOM_PLACE_FORBIDDEN","该自定义地点不属于当前旅行",HttpStatus.FORBIDDEN);}
    public static PlaceView view(PlaceEntity p){return view(p,null);}
    public static PlaceView view(PlaceEntity p,Integer tripCount){return new PlaceView(p.id,p.name,p.countryCode,p.country,p.city,p.area,p.address,p.latitude,p.longitude,p.category,p.sourceType,p.description,p.coverImage,
            p.tagline,p.recommendReason,p.stayMinutes,p.bestTime,splitTags(p.tags),p.editorRank,tripCount);}
    private static List<String> splitTags(String tags){return tags==null||tags.isBlank()?List.of():java.util.Arrays.stream(tags.split(",")).map(String::trim).filter(s->!s.isEmpty()).toList();}
    private static String blank(String s){return s==null||s.isBlank()?null:s.trim();}
}
