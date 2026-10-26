package com.tabitrace.checkin.mapper;

import com.tabitrace.checkin.entity.CheckinEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CheckinMapper {
    @Insert("""
      INSERT INTO checkins(trip_id,place_id,user_id,itinerary_item_id,checkin_type,checkin_time,timezone,latitude,longitude,location_accuracy_m,place_name_snapshot,area_snapshot,note,created_at,updated_at)
      VALUES(#{tripId},#{placeId},#{userId},#{itineraryItemId},#{checkinType},#{checkinTime},#{timezone},#{latitude},#{longitude},#{locationAccuracyM},#{placeNameSnapshot},#{areaSnapshot},#{note},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(CheckinEntity c);
    @Select("SELECT * FROM checkins WHERE id=#{id}") CheckinEntity findById(Long id);
    @Select("SELECT * FROM checkins WHERE trip_id=#{tripId} ORDER BY checkin_time,id") List<CheckinEntity> listByTrip(Long tripId);
    @Update("UPDATE checkins SET checkin_time=#{checkinTime},latitude=#{latitude},longitude=#{longitude},place_name_snapshot=#{placeNameSnapshot},area_snapshot=#{areaSnapshot},note=#{note},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int update(CheckinEntity c);
    @Delete("DELETE FROM checkins WHERE id=#{id}") int delete(Long id);
    /** 写入打卡时刻的天气快照（快速打卡，在同一事务里） */
    @Update("UPDATE checkins SET weather_code=#{weatherCode},weather_text=#{weatherText},temperature_c=#{temperatureC},weather_observed_at=#{weatherObservedAt},weather_source=#{weatherSource} WHERE id=#{id}") int updateWeather(CheckinEntity c);
    @Select("SELECT COUNT(*) FROM checkins WHERE trip_id=#{tripId}") int countByTrip(Long tripId);
    /** 最近的几次打卡（旅行详情“最近记录”），只取需要的条数 */
    @Select("SELECT * FROM checkins WHERE trip_id=#{tripId} ORDER BY checkin_time DESC,id DESC LIMIT #{limit}") List<CheckinEntity> recentByTrip(@Param("tripId") Long tripId,@Param("limit") int limit);
    @Select("SELECT COUNT(DISTINCT area_snapshot) FROM checkins WHERE trip_id=#{tripId} AND area_snapshot IS NOT NULL AND area_snapshot<>''") int countDistinctAreas(Long tripId);
    @Select("SELECT COUNT(DISTINCT c.place_id) FROM checkins c JOIN places p ON p.id=c.place_id WHERE c.trip_id=#{tripId} AND p.source_type='OFFICIAL'") int countOfficial(Long tripId);
    @Select("SELECT COUNT(DISTINCT p.city) FROM checkins c JOIN places p ON p.id=c.place_id WHERE c.trip_id=#{tripId} AND p.city IS NOT NULL") int countDistinctCities(Long tripId);
    @Select("SELECT COUNT(*) FROM checkins WHERE itinerary_item_id=#{itemId}") int countByItinerary(Long itemId);
}
