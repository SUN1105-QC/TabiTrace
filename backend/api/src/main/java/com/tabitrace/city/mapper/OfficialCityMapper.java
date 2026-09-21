package com.tabitrace.city.mapper;

import com.tabitrace.city.entity.OfficialCityEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface OfficialCityMapper {
    @Select("SELECT * FROM official_cities WHERE status='ACTIVE' ORDER BY id") List<OfficialCityEntity> listActive();
    @Select("SELECT * FROM official_cities WHERE code=#{code} AND status='ACTIVE'") OfficialCityEntity findByCode(String code);
}
