package com.tabitrace.city.mapper;

import com.tabitrace.city.entity.OfficialCityEntity;
import com.tabitrace.city.entity.OfficialRouteEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface OfficialCityMapper {
    @Select("SELECT * FROM official_cities WHERE status='ACTIVE' ORDER BY id") List<OfficialCityEntity> listActive();
    @Select("SELECT * FROM official_cities WHERE code=#{code} AND status='ACTIVE'") OfficialCityEntity findByCode(String code);
    /** 按城市名（或英文代码）找到有官方探索内容的城市，例如 东京 / Tokyo → TOKYO */
    @Select("SELECT * FROM official_cities WHERE status='ACTIVE' AND (name=#{city} OR code=UPPER(#{city})) ORDER BY id LIMIT 1") OfficialCityEntity findActiveByCity(String city);
    @Select("SELECT * FROM official_routes WHERE city_code=#{code} ORDER BY sort_order,id") List<OfficialRouteEntity> routes(String code);
}
