package com.tabitrace.trip.service;

import com.tabitrace.common.BusinessException;
import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.city.entity.OfficialCityEntity;
import com.tabitrace.city.mapper.OfficialCityMapper;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.dto.TripDtos.*;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TripService {
    private final TripMapper mapper; private final PlaceMapper places; private final TripPlaceMapper tripPlaces; private final AchievementService achievements; private final OfficialCityMapper officialCities;
    /** 免费版同时可保留的 FREE 旅行数（归档的不计） */
    public static final int FREE_ACTIVE_TRIP_LIMIT=1;
    public TripService(TripMapper mapper,PlaceMapper places,TripPlaceMapper tripPlaces,AchievementService achievements,OfficialCityMapper officialCities){this.officialCities=officialCities;this.mapper=mapper;this.places=places;this.tripPlaces=tripPlaces;this.achievements=achievements;}

    @Transactional
    public TripView create(Long userId,CreateTripRequest r){
        validateDates(r.startDate(),r.endDate());
        if(mapper.countFreeTrips(userId)>=FREE_ACTIVE_TRIP_LIMIT) throw new BusinessException("FREE_TRIP_LIMIT","免费版同时只能保留 1 个 FREE 旅行，请升级已有旅行或归档后再创建");
        TripEntity t=new TripEntity(); t.userId=userId;t.title=r.title().strip();t.destinationName=r.destinationName().strip();t.countryCode=blankToNull(r.countryCode());t.city=blankToNull(r.city());t.startDate=r.startDate();t.endDate=r.endDate();t.peopleCount=r.peopleCount()==null?1:r.peopleCount();t.coverImage=blankToNull(r.coverImage());t.planType="FREE";t.status="PLANNING";t.visibility="PRIVATE";
        mapper.insert(t);
        // 目的地有官方探索内容（official_cities）且用户选择加入时，把该城市的官方地点加入旅行
        OfficialCityEntity official=Boolean.TRUE.equals(r.joinOfficialExplore())?officialCityOf(t):null;
        if(official!=null){
            int sort=1; for(PlaceEntity p:places.findOfficialByCity(official.name)) tripPlaces.add(t.id,p.id,sort++);
        }
        return view(t);
    }
    public List<TripView> list(Long userId){return mapper.findByUser(userId).stream().map(TripService::view).toList();}
    public TripView get(Long userId,Long id){return view(requireOwned(userId,id));}
    @Transactional public TripView update(Long userId,Long id,UpdateTripRequest r){
        validateDates(r.startDate(),r.endDate()); TripEntity t=requireWritable(userId,id);t.title=r.title();t.destinationName=r.destinationName();t.countryCode=blankToNull(r.countryCode());t.city=blankToNull(r.city());t.startDate=r.startDate();t.endDate=r.endDate();t.peopleCount=r.peopleCount()==null?1:r.peopleCount();t.coverImage=blankToNull(r.coverImage());mapper.update(t);return view(mapper.findById(id));
    }
    @Transactional public void delete(Long userId,Long id){requireOwned(userId,id);mapper.delete(id);}
    @Transactional public TripView complete(Long userId,Long id){requireWritable(userId,id);mapper.complete(id);achievements.evaluate(userId,id,"TRIP_COMPLETED");return view(mapper.findById(id));}
    @Transactional public TripView archive(Long userId,Long id){TripEntity t=requireOwned(userId,id);if(!"ARCHIVED".equals(t.status))mapper.updateStatus(id,"ARCHIVED");return view(mapper.findById(id));}
    // 归档视为旅行已结束且不保留原状态，取消归档后统一恢复为 COMPLETED
    @Transactional public TripView unarchive(Long userId,Long id){TripEntity t=requireOwned(userId,id);if(!"ARCHIVED".equals(t.status))return view(t);if("FREE".equals(t.planType)&&mapper.countFreeTrips(userId)>=FREE_ACTIVE_TRIP_LIMIT)throw new BusinessException("FREE_TRIP_LIMIT","免费版同时只能保留 1 个 FREE 旅行，请先归档其他旅行或升级 Trip Pro");mapper.updateStatus(id,"COMPLETED");return view(mapper.findById(id));}
    public TripEntity requireOwned(Long userId,Long id){TripEntity t=mapper.findById(id);if(t==null)throw new BusinessException("TRIP_NOT_FOUND","旅行不存在",HttpStatus.NOT_FOUND);if(!userId.equals(t.userId))throw new BusinessException("TRIP_FORBIDDEN","不能访问其他用户的旅行",HttpStatus.FORBIDDEN);return t;}
    public TripEntity requireWritable(Long userId,Long id){TripEntity t=requireOwned(userId,id);if("ARCHIVED".equals(t.status))throw new BusinessException("TRIP_ARCHIVED","旅行已归档，取消归档后才能修改",HttpStatus.CONFLICT);return t;}
    /** 按旅行的城市、再按目的地名称匹配官方城市 */
    OfficialCityEntity officialCityOf(TripEntity t){
        OfficialCityEntity c=t.city==null?null:officialCities.findActiveByCity(t.city);
        return c!=null?c:officialCities.findActiveByCity(t.destinationName);
    }
    public static boolean isTokyo(TripEntity t){return "东京".equals(t.city)||"Tokyo".equalsIgnoreCase(t.city)|| (t.destinationName!=null&&(t.destinationName.contains("东京")||t.destinationName.toLowerCase().contains("tokyo")));}
    public static TripView view(TripEntity t){return new TripView(t.id,t.title,t.destinationName,t.countryCode,t.city,t.startDate,t.endDate,t.peopleCount,t.coverImage,t.planType,t.status,t.visibility,t.createdAt);}
    private static void validateDates(java.time.LocalDate s,java.time.LocalDate e){if(e.isBefore(s))throw new BusinessException("INVALID_TRIP_DATES","结束日期不能早于开始日期");}
    private static String blankToNull(String s){return s==null||s.isBlank()?null:s.trim();}
}
