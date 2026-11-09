package com.tabitrace.city.service;

import com.tabitrace.city.mapper.ExploreDirectoryMapper;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

/** 公开探索目录的展示数据；预告仅用于目录展示，不放开正式城市详情的访问条件。 */
@Service
public class ExploreDirectoryService {
    public record City(Long id,String code,String name,String englishName,String region,String description,
                       List<String> tags,String status,String href,String cover,int placeCount,int routeCount) {}
    public record Country(String code,String slug,String name,String englishName,String theme,String description,List<City> cities) {}
    public record Stats(int countryCount,int cityCount,int openCountryCount,int openCityCount,int placeCount,int routeCount) {}
    public record Directory(List<Country> countries,Stats stats) {}
    private final ExploreDirectoryMapper mapper;
    private final ObjectMapper json;
    // 只有已实现的城市页面才登记入口；新增预告不等于已发布指南，也不能生成不存在的链接。
    private static final Set<String> EXISTING_CITY_ROUTES=Set.of("/explore/tokyo","/explore/seoul","/explore/hong-kong","/explore/taipei");
    public ExploreDirectoryService(ExploreDirectoryMapper mapper,ObjectMapper json){this.mapper=mapper;this.json=json;}

    public Directory load() {
        Map<String,List<City>> grouped=new HashMap<>();
        // 查询层已过滤发布状态，这里再次守住公开白名单，防止草稿或未知状态进入响应。
        for(var row:mapper.cities()) {
            if(!Boolean.TRUE.equals(row.published)||row.status==null||!Set.of("ACTIVE","COMING_SOON","PLANNED").contains(row.status))continue;
            boolean open="ACTIVE".equals(row.status)&&row.explorePath!=null&&EXISTING_CITY_ROUTES.contains(row.explorePath);
            String status=open?"OPEN":"PLANNED".equals(row.status)?"PLANNED":"PREPARING";
            var city=new City(row.id,row.code,row.name,row.englishName,row.region,row.summary,
                    tags(row.tagsJson),status,open?row.explorePath:null,row.cover,open?row.placeCount:0,open?row.routeCount:0);
            grouped.computeIfAbsent(row.countryCode,k->new ArrayList<>()).add(city);
        }
        var countries=mapper.countries().stream().filter(r->Boolean.TRUE.equals(r.published))
                .map(r->new Country(r.code,r.slug,r.name,r.englishName,r.theme,r.description,
                        List.copyOf(grouped.getOrDefault(r.code,List.of())))).toList();
        var cities=countries.stream().flatMap(c->c.cities().stream()).toList();
        // 地点和路线统计只累计真正开放且可进入的城市，预告不贡献虚假的可用数量。
        var open=cities.stream().filter(c->"OPEN".equals(c.status())).toList();
        return new Directory(countries,new Stats(countries.size(),cities.size(),
                (int)countries.stream().filter(c->c.cities().stream().anyMatch(city->"OPEN".equals(city.status()))).count(),
                open.size(),open.stream().mapToInt(City::placeCount).sum(),open.stream().mapToInt(City::routeCount).sum()));
    }
    private List<String> tags(String raw) {
        if(raw==null||raw.isBlank())return List.of();
        try{return json.readValue(raw,new TypeReference<List<String>>(){}).stream().filter(Objects::nonNull).limit(8).toList();}
        catch(RuntimeException ex){return List.of();}
    }
}
