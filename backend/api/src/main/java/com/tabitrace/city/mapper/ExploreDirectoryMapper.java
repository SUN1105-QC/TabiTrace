package com.tabitrace.city.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/** 目录只关联公开编辑条目与官方内容，不查询用户旅行、照片或收藏信息。 */
@Mapper
public interface ExploreDirectoryMapper {
    class CountryRow {
        public String code, slug, name, englishName, theme, description;
        public Boolean published;
    }
    class CityRow {
        public Long id;
        public String code, countryCode, name, englishName, region, summary, cover, status, tagsJson, explorePath;
        public Boolean published;
        public int placeCount, routeCount;
    }
    @Select("SELECT code,slug,name,english_name,theme,description,published FROM explore_countries WHERE published=TRUE ORDER BY sort_order,code")
    List<CountryRow> countries();

    // 地点、路线先按城市聚合后连接，避免每个城市再发起独立计数查询。
    @Select("""
      SELECT c.id,c.code,e.country_code,c.name,e.english_name,
             (SELECT d.country_name FROM destinations d WHERE d.name=c.name AND d.country_code=c.country_code ORDER BY d.id LIMIT 1) AS region,
             e.summary,c.cover_image AS cover,c.status,CAST(e.tags AS CHAR) AS tags_json,e.explore_path,e.published,
             COALESCE(p.n,0) AS place_count,COALESCE(r.n,0) AS route_count
      FROM explore_city_entries e
      JOIN official_cities c ON c.code=e.city_code
      JOIN explore_countries ec ON ec.code=e.country_code AND ec.published=TRUE
      LEFT JOIN (SELECT city,COUNT(*) AS n FROM places WHERE source_type='OFFICIAL' GROUP BY city) p ON p.city=c.name
      LEFT JOIN (SELECT city_code,COUNT(*) AS n FROM official_routes GROUP BY city_code) r ON r.city_code=c.code
      WHERE e.published=TRUE AND c.status IN ('ACTIVE','COMING_SOON','PLANNED')
      ORDER BY e.sort_order,c.id
      """)
    List<CityRow> cities();
}
