package com.tabitrace.place.mapper;

import com.tabitrace.place.entity.PlaceEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PlaceMapper {
    @Select("SELECT * FROM places WHERE id=#{id}") PlaceEntity findById(Long id);
    @Select("""
      SELECT * FROM places WHERE source_type='OFFICIAL' AND (name LIKE CONCAT('%',#{q},'%') OR area LIKE CONCAT('%',#{q},'%') OR city LIKE CONCAT('%',#{q},'%'))
      ORDER BY name LIMIT 30
      """) List<PlaceEntity> search(String q);
    @Select("SELECT * FROM places WHERE source_type='OFFICIAL' AND city=#{city} ORDER BY id") List<PlaceEntity> findOfficialByCity(String city);
    @Select("SELECT COUNT(*) FROM places WHERE source_type='OFFICIAL' AND city=#{city}") int countOfficialByCity(String city);
    @Select("SELECT p.* FROM trip_places tp JOIN places p ON p.id=tp.place_id WHERE tp.trip_id=#{tripId} ORDER BY tp.sort_order,tp.id") List<PlaceEntity> findByTrip(Long tripId);
    @Insert("""
      INSERT INTO places(name,country_code,country,city,area,address,latitude,longitude,category,source_type,description,cover_image,created_at,updated_at)
      VALUES(#{name},#{countryCode},#{country},#{city},#{area},#{address},#{latitude},#{longitude},#{category},#{sourceType},#{description},#{coverImage},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(PlaceEntity place);
}
