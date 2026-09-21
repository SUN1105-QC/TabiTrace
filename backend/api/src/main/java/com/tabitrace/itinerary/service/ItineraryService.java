package com.tabitrace.itinerary.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.itinerary.dto.ItineraryDtos.*;
import com.tabitrace.itinerary.entity.ItineraryItemEntity;
import com.tabitrace.itinerary.mapper.ItineraryMapper;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ItineraryService {
    private final ItineraryMapper mapper; private final PlaceMapper places; private final TripPlaceMapper tripPlaces; private final TripService trips;
    public ItineraryService(ItineraryMapper mapper,PlaceMapper places,TripPlaceMapper tripPlaces,TripService trips){this.mapper=mapper;this.places=places;this.tripPlaces=tripPlaces;this.trips=trips;}
    @Transactional public ItineraryView create(Long userId,Long tripId,UpsertItineraryRequest r){TripEntity trip=trips.requireWritable(userId,tripId);validateDate(trip,r);ItineraryItemEntity i=toEntity(null,tripId,r);if(i.placeId==null&&(i.customPlaceName==null||i.customPlaceName.isBlank()))throw new BusinessException("ITINERARY_PLACE_REQUIRED","请选择地点或输入地点名称");i.status=normalizeStatus(r.status());i.sortOrder=r.sortOrder()==null?mapper.nextSort(tripId):r.sortOrder();if(i.placeId!=null) fillPlace(i,tripId);mapper.insert(i);return view(i);}
    public List<ItineraryView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);return mapper.listByTrip(tripId).stream().map(this::view).toList();}
    public ItineraryItemEntity requireOwnedItem(Long userId,Long tripId,Long id){trips.requireOwned(userId,tripId);ItineraryItemEntity i=mapper.findById(id);if(i==null||!tripId.equals(i.tripId))throw new BusinessException("ITINERARY_NOT_FOUND","行程不存在",HttpStatus.NOT_FOUND);return i;}
    @Transactional public ItineraryView update(Long userId,Long tripId,Long id,UpsertItineraryRequest r){TripEntity trip=trips.requireWritable(userId,tripId);validateDate(trip,r);ItineraryItemEntity old=requireOwnedItem(userId,tripId,id);ItineraryItemEntity i=toEntity(id,tripId,r);i.status=normalizeStatus(r.status()==null?old.status:r.status());i.sortOrder=r.sortOrder()==null?old.sortOrder:r.sortOrder();if(i.placeId!=null)fillPlace(i,tripId);mapper.update(i);return view(mapper.findById(id));}
    @Transactional public void delete(Long userId,Long tripId,Long id){trips.requireWritable(userId,tripId);requireOwnedItem(userId,tripId,id);mapper.delete(id);}
    public ItineraryView view(ItineraryItemEntity i){String name=i.customPlaceName;if(i.placeId!=null){PlaceEntity p=places.findById(i.placeId);if(p!=null)name=p.name;}return new ItineraryView(i.id,i.placeId,name,i.area,i.plannedDate,i.plannedTime,i.note,i.latitude,i.longitude,i.status,i.sortOrder,i.createdAt);}
    private ItineraryItemEntity toEntity(Long id,Long tripId,UpsertItineraryRequest r){ItineraryItemEntity i=new ItineraryItemEntity();i.id=id;i.tripId=tripId;i.placeId=r.placeId();i.customPlaceName=blank(r.customPlaceName());i.area=blank(r.area());i.plannedDate=r.plannedDate();i.plannedTime=r.plannedTime();i.note=blank(r.note());i.latitude=r.latitude();i.longitude=r.longitude();return i;}
    private void fillPlace(ItineraryItemEntity i,Long tripId){PlaceEntity p=places.findById(i.placeId);if(p==null)throw new BusinessException("PLACE_NOT_FOUND","地点不存在",HttpStatus.NOT_FOUND);if("CUSTOM".equals(p.sourceType)&&tripPlaces.exists(tripId,p.id)==0)throw new BusinessException("CUSTOM_PLACE_FORBIDDEN","该自定义地点不属于当前旅行",HttpStatus.FORBIDDEN);if(i.area==null)i.area=p.area;if(i.latitude==null)i.latitude=p.latitude;if(i.longitude==null)i.longitude=p.longitude;}
    private static String normalizeStatus(String s){if(s==null||s.isBlank())return "PLANNED";String v=s.toUpperCase();if(!List.of("PLANNED","DONE","CANCELLED").contains(v))throw new BusinessException("INVALID_ITINERARY_STATUS","行程状态不正确");return v;}
    private static void validateDate(TripEntity t,UpsertItineraryRequest r){if(r.plannedDate().isBefore(t.startDate)||r.plannedDate().isAfter(t.endDate))throw new BusinessException("ITINERARY_DATE_OUTSIDE_TRIP","行程日期需要位于旅行日期范围内");}
    private static String blank(String s){return s==null||s.isBlank()?null:s.trim();}
}
