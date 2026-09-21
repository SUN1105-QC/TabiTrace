package com.tabitrace.itinerary.mapper;

import com.tabitrace.itinerary.entity.ItineraryItemEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ItineraryMapper {
    @Insert("""
      INSERT INTO itinerary_items(trip_id,place_id,custom_place_name,area,planned_date,planned_time,note,latitude,longitude,status,sort_order,created_at,updated_at)
      VALUES(#{tripId},#{placeId},#{customPlaceName},#{area},#{plannedDate},#{plannedTime},#{note},#{latitude},#{longitude},#{status},#{sortOrder},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(ItineraryItemEntity item);
    @Select("SELECT * FROM itinerary_items WHERE id=#{id}") ItineraryItemEntity findById(Long id);
    @Select("SELECT * FROM itinerary_items WHERE trip_id=#{tripId} ORDER BY planned_date,planned_time,sort_order,id") List<ItineraryItemEntity> listByTrip(Long tripId);
    @Select("SELECT COALESCE(MAX(sort_order),0)+1 FROM itinerary_items WHERE trip_id=#{tripId}") int nextSort(Long tripId);
    @Update("""
      UPDATE itinerary_items SET place_id=#{placeId},custom_place_name=#{customPlaceName},area=#{area},planned_date=#{plannedDate},planned_time=#{plannedTime},note=#{note},latitude=#{latitude},longitude=#{longitude},status=#{status},sort_order=#{sortOrder},updated_at=UTC_TIMESTAMP() WHERE id=#{id}
      """) int update(ItineraryItemEntity item);
    @Update("UPDATE itinerary_items SET status='DONE',updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int markDone(Long id);
    @Update("UPDATE itinerary_items SET status='PLANNED',updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int markPlanned(Long id);
    @Delete("DELETE FROM itinerary_items WHERE id=#{id}") int delete(Long id);
}
