package com.tabitrace.summary.service;

import com.tabitrace.achievement.mapper.AchievementMapper;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.entity.PhotoEntity;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.summary.dto.SummaryDtos.*;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class SummaryService {
    private final TripService trips;private final CheckinMapper checkins;private final PhotoMapper photos;private final PlaceMapper places;private final AchievementMapper achievements;private final UserMapper users;
    public SummaryService(TripService trips,CheckinMapper checkins,PhotoMapper photos,PlaceMapper places,AchievementMapper achievements,UserMapper users){this.trips=trips;this.checkins=checkins;this.photos=photos;this.places=places;this.achievements=achievements;this.users=users;}
    public TripSummary get(Long userId,Long tripId){TripEntity t=trips.requireOwned(userId,tripId);List<CheckinEntity> cs=checkins.listByTrip(tripId);List<PhotoEntity> ps=photos.listByTrip(tripId);int dayCount=(int)ChronoUnit.DAYS.between(t.startDate,t.endDate)+1;int official=checkins.countOfficial(tripId);int officialTotal=TripService.isTokyo(t)?places.countOfficialByCity("东京"):0;int rate=officialTotal==0?0:Math.min(100,(int)Math.round(official*100.0/officialTotal));int earned=achievements.countEarned(tripId);java.time.ZoneId zone=zone(userId);Map<LocalDate,Integer> cc=new HashMap<>(),pc=new HashMap<>();for(CheckinEntity c:cs){LocalDate d=c.checkinTime.atOffset(java.time.ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDate();cc.merge(d,1,Integer::sum);}for(PhotoEntity p:ps){java.time.LocalDateTime raw=p.capturedAt!=null?p.capturedAt:p.createdAt;LocalDate d=raw.atOffset(java.time.ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDate();pc.merge(d,1,Integer::sum);}List<DailyStatus> daily=new ArrayList<>();for(LocalDate d=t.startDate;!d.isAfter(t.endDate);d=d.plusDays(1)){int c=cc.getOrDefault(d,0),p=pc.getOrDefault(d,0);daily.add(new DailyStatus(d,c,p,c>0||p>0));}int featured=(int)ps.stream().filter(p->Boolean.TRUE.equals(p.featured)).count();int recorded=(int)daily.stream().filter(DailyStatus::hasRecord).count();OutputReadiness readiness=new OutputReadiness(featured,earned,recorded,!cs.isEmpty(),ps.size()>=3&&!cs.isEmpty());Set<String> uniquePlaces=new HashSet<>();for(CheckinEntity c:cs){uniquePlaces.add(c.placeId!=null?"id:"+c.placeId:"name:"+(c.placeNameSnapshot==null?"":c.placeNameSnapshot.trim().toLowerCase(Locale.ROOT)));}return new TripSummary(t.id,t.title,t.status,t.planType,dayCount,uniquePlaces.size(),ps.size(),checkins.countDistinctCities(tripId),checkins.countDistinctAreas(tripId),official,officialTotal,rate,earned,daily,readiness);}
    private java.time.ZoneId zone(Long userId){var u=users.findById(userId);try{return java.time.ZoneId.of(u==null||u.timezone==null?"UTC":u.timezone);}catch(Exception ex){return java.time.ZoneId.of("UTC");}}
}
