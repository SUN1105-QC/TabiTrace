package com.tabitrace.place.mapper;

import org.apache.ibatis.annotations.*;

@Mapper
public interface TripPlaceMapper {
    @Insert("INSERT IGNORE INTO trip_places(trip_id,place_id,sort_order,created_at) VALUES(#{tripId},#{placeId},#{sortOrder},UTC_TIMESTAMP())")
    int add(@Param("tripId") Long tripId,@Param("placeId") Long placeId,@Param("sortOrder") int sortOrder);
    @Delete("DELETE FROM trip_places WHERE trip_id=#{tripId} AND place_id=#{placeId}") int remove(@Param("tripId") Long tripId,@Param("placeId") Long placeId);
    @Select("SELECT COUNT(*) FROM trip_places WHERE trip_id=#{tripId} AND place_id=#{placeId}") int exists(@Param("tripId") Long tripId,@Param("placeId") Long placeId);
    @Select("SELECT COALESCE(MAX(sort_order),0)+1 FROM trip_places WHERE trip_id=#{tripId}") int nextSort(Long tripId);
}
