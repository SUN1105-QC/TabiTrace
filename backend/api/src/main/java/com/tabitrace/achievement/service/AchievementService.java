package com.tabitrace.achievement.service;

import com.tabitrace.achievement.dto.AchievementDtos.AchievementView;
import com.tabitrace.achievement.entity.AchievementEntity;
import com.tabitrace.achievement.mapper.AchievementMapper;
import com.tabitrace.checkin.entity.CheckinEntity;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class AchievementService {
    private final AchievementMapper mapper;private final CheckinMapper checkins;private final PhotoMapper photos;private final TripMapper trips;
    public AchievementService(AchievementMapper mapper,CheckinMapper checkins,PhotoMapper photos,TripMapper trips){this.mapper=mapper;this.checkins=checkins;this.photos=photos;this.trips=trips;}
    public List<AchievementView> list(Long userId,Long tripId){TripEntity trip=trips.findById(tripId);String cityCode=isTokyo(trip)?"TOKYO":null;Map<Long,java.time.LocalDateTime> earnedAt=new HashMap<>();for(var row:mapper.earnedRows(userId,tripId))earnedAt.put(((Number)row.get("achievementId")).longValue(),(java.time.LocalDateTime)row.get("earnedAt"));return mapper.listForCity(cityCode).stream().map(a->new AchievementView(a.id,a.code,a.name,a.description,a.type,a.cityCode,a.iconUrl,earnedAt.containsKey(a.id),progress(a,tripId),earnedAt.get(a.id))).toList();}
    @Transactional public void evaluate(Long userId,Long tripId,String event){TripEntity trip=trips.findById(tripId);if(trip==null)return;String cityCode=isTokyo(trip)?"TOKYO":null;Set<Long> earned=new HashSet<>(mapper.earnedIds(userId,tripId));for(AchievementEntity a:mapper.listForCity(cityCode)){if(!earned.contains(a.id)&&qualifies(a,tripId))mapper.earn(userId,tripId,a.id);}}
    private boolean qualifies(AchievementEntity a,Long tripId){return progress(a,tripId)>=100;}
    private int progress(AchievementEntity a,Long tripId){int checkinCount=checkins.countByTrip(tripId);int photoCount=photos.countByTrip(tripId);int areaCount=checkins.countDistinctAreas(tripId);int officialCount=checkins.countOfficial(tripId);int target=a.conditionValue==null||a.conditionValue<=0?1:a.conditionValue;return switch(a.conditionType==null?"":a.conditionType){case "CHECKIN_COUNT"->pct(checkinCount,target);case "PHOTO_COUNT"->pct(photoCount,target);case "AREA_COUNT"->pct(areaCount,target);case "OFFICIAL_CHECKIN_COUNT"->pct(officialCount,target);case "TOKYO_TRADITION"->pct(countRequiredPlaces(tripId,Set.of("浅草寺","明治神宫")),2);case "TOKYO_NIGHT"->pct(countRequiredPlaces(tripId,Set.of("东京塔","涩谷十字路口","新宿","歌舞伎町","涩谷 SKY")),target);case "TRIP_COMPLETED"->"COMPLETED".equals(Optional.ofNullable(trips.findById(tripId)).map(t->t.status).orElse(""))?100:0;default->0;};}
    private int countRequiredPlaces(Long tripId,Set<String> names){Set<String> seen=new HashSet<>();for(CheckinEntity c:checkins.listByTrip(tripId))if(names.contains(c.placeNameSnapshot))seen.add(c.placeNameSnapshot);return seen.size();}
    private static int pct(int v,int target){return Math.min(100,(int)Math.round(v*100.0/target));}
    private static boolean isTokyo(TripEntity t){return t!=null&&(Objects.equals(t.city,"东京")||"Tokyo".equalsIgnoreCase(t.city)||(t.destinationName!=null&&(t.destinationName.contains("东京")||t.destinationName.toLowerCase().contains("tokyo"))));}
}
