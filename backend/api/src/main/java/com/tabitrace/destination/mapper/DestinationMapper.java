package com.tabitrace.destination.mapper;

import org.apache.ibatis.annotations.*;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface DestinationMapper {
    class DestinationRow { public Long id; public String name; public String nameEn; public String countryCode; public String countryName;
        public BigDecimal latitude; public BigDecimal longitude; public String timezone; public String officialCode; public String officialName; public String officialCover; }

    /**
     * 名称 / 英文名 / 国家模糊匹配；精确匹配优先，其次前缀匹配，再按热度。q 为空时返回热门目的地。
     * like 为已转义的 LIKE 片段（%、_ 已转义）。
     */
    @Select("""
        SELECT d.id,d.name,d.name_en,d.country_code,d.country_name,d.latitude,d.longitude,d.timezone,
               oc.code AS official_code,oc.name AS official_name,oc.cover_image AS official_cover
        FROM destinations d
        LEFT JOIN official_cities oc ON oc.code=d.official_city_code AND oc.status='ACTIVE'
        WHERE #{q}='' OR d.name LIKE CONCAT('%',#{like},'%') OR d.name_en LIKE CONCAT('%',#{like},'%') OR d.country_name LIKE CONCAT('%',#{like},'%')
        ORDER BY (d.name=#{q} OR d.name_en=#{q}) DESC,
                 (d.name LIKE CONCAT(#{like},'%') OR d.name_en LIKE CONCAT(#{like},'%')) DESC,
                 d.popularity DESC, d.id
        LIMIT #{limit}
        """)
    List<DestinationRow> search(@Param("q") String q, @Param("like") String like, @Param("limit") int limit);

    @Select("SELECT COUNT(*) FROM places WHERE source_type='OFFICIAL' AND city=#{city}") int countOfficialPlaces(String city);
    @Select("SELECT COUNT(*) FROM official_routes WHERE city_code=#{code}") int countRoutes(String code);
}
