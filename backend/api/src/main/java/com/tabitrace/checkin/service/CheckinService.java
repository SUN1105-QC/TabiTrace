package com.tabitrace.checkin.service;

import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.checkin.dto.CheckinDtos.*;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.itinerary.dto.ItineraryDtos.ItineraryCheckinRequest;
import com.tabitrace.itinerary.entity.ItineraryItemEntity;
import com.tabitrace.itinerary.mapper.ItineraryMapper;
import com.tabitrace.itinerary.service.ItineraryService;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class CheckinService {
    private final CheckinMapper mapper;private final TripService trips;private final TripMapper tripMapper;private final PlaceMapper places;private final TripPlaceMapper tripPlaces;private final ItineraryMapper itinerary;private final ItineraryService itineraryService;private final PhotoMapper photos;private final AchievementService achievements;private final UserMapper users;
    public CheckinService(CheckinMapper mapper,TripService trips,TripMapper tripMapper,PlaceMapper places,TripPlaceMapper tripPlaces,ItineraryMapper itinerary,ItineraryService itineraryService,PhotoMapper photos,AchievementService achievements,UserMapper users){this.mapper=mapper;this.trips=trips;this.tripMapper=tripMapper;this.places=places;this.tripPlaces=tripPlaces;this.itinerary=itinerary;this.itineraryService=itineraryService;this.photos=photos;this.achievements=achievements;this.users=users;}
    @Transactional public CheckinView create(Long userId,Long tripId,CreateCheckinRequest r){TripEntity trip=trips.requireWritable(userId,tripId);checkFreeLimit(trip);if(r.itineraryItemId()!=null){ItineraryItemEntity item=itineraryService.requireOwnedItem(userId,tripId,r.itineraryItemId());if(r.placeId()!=null&&item.placeId!=null&&!r.placeId().equals(item.placeId))throw new BusinessException("ITINERARY_PLACE_MISMATCH","打卡地点与行程地点不一致");}CheckinEntity c=new CheckinEntity();c.tripId=tripId;c.userId=userId;c.placeId=r.placeId();c.itineraryItemId=r.itineraryItemId();c.checkinType="MANUAL";validateLocalDate(trip,r.checkinTime());c.checkinTime=toUtc(r.checkinTime());c.latitude=r.latitude();c.longitude=r.longitude();c.placeNameSnapshot=blank(r.placeName());c.areaSnapshot=blank(r.area());c.note=blank(r.note());resolvePlace(c,tripId);mapper.insert(c);if(c.placeId!=null)tripPlaces.add(tripId,c.placeId,tripPlaces.nextSort(tripId));if(c.itineraryItemId!=null)itinerary.markDone(c.itineraryItemId);if("PLANNING".equals(trip.status))tripMapper.updateStatus(tripId,"ONGOING");achievements.evaluate(userId,tripId,"CHECKIN_CREATED");return view(c,zone(userId));}
    @Transactional public CheckinView fromItinerary(Long userId,Long tripId,Long itemId,ItineraryCheckinRequest r){ItineraryItemEntity item=itineraryService.requireOwnedItem(userId,tripId,itemId);if("DONE".equals(item.status)&&mapper.countByItinerary(itemId)>0)throw new BusinessException("ITINERARY_ALREADY_CHECKED_IN","该行程已经完成打卡");OffsetDateTime time=r!=null&&r.checkinTime()!=null?r.checkinTime():java.time.ZonedDateTime.of(item.plannedDate,item.plannedTime==null?java.time.LocalTime.NOON:item.plannedTime,zone(userId)).toOffsetDateTime();String note=r!=null&&r.note()!=null?r.note():item.note;return create(userId,tripId,new CreateCheckinRequest(item.placeId,item.id,time,item.latitude,item.longitude,item.customPlaceName,item.area,note));}
    public List<CheckinView> list(Long userId,Long tripId){trips.requireOwned(userId,tripId);ZoneId z=zone(userId);return mapper.listByTrip(tripId).stream().map(c->view(c,z)).toList();}
    public List<TimelineDay> timeline(Long userId,Long tripId){trips.requireOwned(userId,tripId);ZoneId z=zone(userId);Map<java.time.LocalDate,List<TimelineItem>> grouped=new LinkedHashMap<>();for(CheckinEntity c:mapper.listByTrip(tripId)){List<TimelinePhoto> ps=photos.listByCheckin(c.id).stream().map(p->photoView(p,z)).toList();java.time.LocalDate day=c.checkinTime.atOffset(ZoneOffset.UTC).atZoneSameInstant(z).toLocalDate();grouped.computeIfAbsent(day,k->new ArrayList<>()).add(new TimelineItem(view(c,z),ps));}return grouped.entrySet().stream().map(e->new TimelineDay(e.getKey(),e.getValue())).toList();}
    @Transactional public CheckinView update(Long userId,Long id,UpdateCheckinRequest r){CheckinEntity c=requireWritable(userId,id);TripEntity trip=tripMapper.findById(c.tripId);validateLocalDate(trip,r.checkinTime());c.checkinTime=toUtc(r.checkinTime());c.latitude=r.latitude();c.longitude=r.longitude();if(r.placeName()!=null)c.placeNameSnapshot=blank(r.placeName());if(r.area()!=null)c.areaSnapshot=blank(r.area());c.note=blank(r.note());mapper.update(c);return view(mapper.findById(id),zone(userId));}
    @Transactional public void delete(Long userId,Long id){CheckinEntity c=requireWritable(userId,id);mapper.delete(id);if(c.itineraryItemId!=null)itinerary.markPlanned(c.itineraryItemId);achievements.evaluate(userId,c.tripId,"CHECKIN_DELETED");}
    private CheckinEntity requireWritable(Long userId,Long id){CheckinEntity c=mapper.findById(id);if(c==null)throw new BusinessException("CHECKIN_NOT_FOUND","打卡不存在",HttpStatus.NOT_FOUND);trips.requireWritable(userId,c.tripId);return c;}
    private void resolvePlace(CheckinEntity c,Long tripId){if(c.placeId!=null){PlaceEntity p=places.findById(c.placeId);if(p==null)throw new BusinessException("PLACE_NOT_FOUND","地点不存在",HttpStatus.NOT_FOUND);if("CUSTOM".equals(p.sourceType)&&tripPlaces.exists(tripId,p.id)==0)throw new BusinessException("CUSTOM_PLACE_FORBIDDEN","该自定义地点不属于当前旅行",HttpStatus.FORBIDDEN);if(c.placeNameSnapshot==null)c.placeNameSnapshot=p.name;if(c.areaSnapshot==null)c.areaSnapshot=p.area;if(c.latitude==null)c.latitude=p.latitude;if(c.longitude==null)c.longitude=p.longitude;}if(c.placeNameSnapshot==null||c.placeNameSnapshot.isBlank())throw new BusinessException("CHECKIN_PLACE_REQUIRED","打卡地点不能为空");}
    /** 免费旅行最多可以打卡的次数（Trip Pro 不限） */
    public static final int FREE_CHECKIN_LIMIT=10;
    private void checkFreeLimit(TripEntity trip){if("FREE".equals(trip.planType)&&mapper.countByTrip(trip.id)>=FREE_CHECKIN_LIMIT)throw new BusinessException("FREE_CHECKIN_LIMIT","免费旅行最多 "+FREE_CHECKIN_LIMIT+" 个打卡，请升级 Trip Pro");}
    private static void validateLocalDate(TripEntity t,OffsetDateTime dt){if(dt.toLocalDate().isBefore(t.startDate)||dt.toLocalDate().isAfter(t.endDate))throw new BusinessException("CHECKIN_TIME_OUTSIDE_TRIP","打卡日期需要位于旅行日期范围内");}
    private static LocalDateTime toUtc(OffsetDateTime dt){return dt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();}
    private ZoneId zone(Long userId){var u=users.findById(userId);try{return ZoneId.of(u==null||u.timezone==null?"UTC":u.timezone);}catch(Exception ex){return ZoneId.of("UTC");}}
    private CheckinView view(CheckinEntity c,ZoneId zone){OffsetDateTime time=c.checkinTime.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toOffsetDateTime();OffsetDateTime created=c.createdAt==null?null:c.createdAt.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toOffsetDateTime();return new CheckinView(c.id,c.tripId,c.placeId,c.itineraryItemId,c.checkinType,time,c.latitude,c.longitude,c.placeNameSnapshot,c.areaSnapshot,c.note,created);}
    private static TimelinePhoto photoView(PhotoEntity p,ZoneId zone){OffsetDateTime captured=p.capturedAt==null?null:p.capturedAt.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toOffsetDateTime();return new TimelinePhoto(p.id,p.imageUrl,null,Boolean.TRUE.equals(p.featured),captured);}
    private static String blank(String s){return s==null||s.isBlank()?null:s.trim();}
}
