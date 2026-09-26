package com.tabitrace.achievement.service;

import com.tabitrace.achievement.dto.AchievementDtos.AchievementView;
import com.tabitrace.achievement.dto.AchievementDtos.Requirement;
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
    /** 东京传统派：两处都要打卡 */
    static final List<String> TRADITION_PLACES = List.of("浅草寺", "明治神宫");
    /** 东京夜行者：在这些夜景地点里打卡够 condition_value 个 */
    static final List<String> NIGHT_PLACES = List.of("东京塔", "涩谷十字路口", "新宿", "歌舞伎町", "涩谷 SKY");

    private final AchievementMapper mapper;private final CheckinMapper checkins;private final PhotoMapper photos;private final TripMapper trips;
    public AchievementService(AchievementMapper mapper,CheckinMapper checkins,PhotoMapper photos,TripMapper trips){this.mapper=mapper;this.checkins=checkins;this.photos=photos;this.trips=trips;}

    /** 一段旅行的统计，每次请求只查一次，所有成就共用 */
    record Stats(int checkins, int photos, int areas, int official, Set<String> visited, boolean completed) {}

    /** 某个成就在这段旅行里的真实进度 */
    record Measure(int current, int target, List<Requirement> requirements) {
        int percent() { return Math.min(100, (int) Math.round(current * 100.0 / Math.max(1, target))); }
        boolean reached() { return current >= Math.max(1, target); }
    }

    public List<AchievementView> list(Long userId,Long tripId){
        TripEntity trip=trips.findById(tripId);
        String cityCode=isTokyo(trip)?"TOKYO":null;
        Map<Long,java.time.LocalDateTime> earnedAt=new HashMap<>();
        for(var row:mapper.earnedRows(userId,tripId))earnedAt.put(((Number)row.get("achievementId")).longValue(),(java.time.LocalDateTime)row.get("earnedAt"));
        Stats stats=stats(trip,tripId);
        return mapper.listForCity(cityCode).stream().map(a->{
            Measure m=measure(a,stats);
            return new AchievementView(a.id,a.code,a.name,a.description,a.type,a.cityCode,a.iconUrl,earnedAt.containsKey(a.id),m.percent(),earnedAt.get(a.id),
                    a.conditionType,m.current(),m.target(),m.requirements());
        }).toList();
    }

    @Transactional public void evaluate(Long userId,Long tripId,String event){
        TripEntity trip=trips.findById(tripId);if(trip==null)return;
        String cityCode=isTokyo(trip)?"TOKYO":null;
        Set<Long> earned=new HashSet<>(mapper.earnedIds(userId,tripId));
        Stats stats=stats(trip,tripId);
        for(AchievementEntity a:mapper.listForCity(cityCode)){if(!earned.contains(a.id)&&measure(a,stats).reached())mapper.earn(userId,tripId,a.id);}
    }

    private Stats stats(TripEntity trip,Long tripId){
        Set<String> visited=new HashSet<>();
        for(CheckinEntity c:checkins.listByTrip(tripId))if(c.placeNameSnapshot!=null)visited.add(c.placeNameSnapshot);
        return new Stats(checkins.countByTrip(tripId),photos.countByTrip(tripId),checkins.countDistinctAreas(tripId),checkins.countOfficial(tripId),visited,
                trip!=null&&"COMPLETED".equals(trip.status));
    }

    static Measure measure(AchievementEntity a,Stats s){
        int target=a.conditionValue==null||a.conditionValue<=0?1:a.conditionValue;
        return switch(a.conditionType==null?"":a.conditionType){
            case "CHECKIN_COUNT"->new Measure(s.checkins(),target,List.of());
            case "PHOTO_COUNT"->new Measure(s.photos(),target,List.of());
            case "AREA_COUNT"->new Measure(s.areas(),target,List.of());
            case "OFFICIAL_CHECKIN_COUNT"->new Measure(s.official(),target,List.of());
            case "TOKYO_TRADITION"->places(TRADITION_PLACES,TRADITION_PLACES.size(),s);
            case "TOKYO_NIGHT"->places(NIGHT_PLACES,target,s);
            case "TRIP_COMPLETED"->new Measure(s.completed()?1:0,1,List.of());
            default->new Measure(0,target,List.of());
        };
    }

    private static Measure places(List<String> names,int target,Stats s){
        List<Requirement> reqs=names.stream().map(n->new Requirement(n,s.visited().contains(n))).toList();
        return new Measure((int)reqs.stream().filter(Requirement::done).count(),target,reqs);
    }

    private static boolean isTokyo(TripEntity t){return t!=null&&(Objects.equals(t.city,"东京")||"Tokyo".equalsIgnoreCase(t.city)||(t.destinationName!=null&&(t.destinationName.contains("东京")||t.destinationName.toLowerCase().contains("tokyo"))));}
}
