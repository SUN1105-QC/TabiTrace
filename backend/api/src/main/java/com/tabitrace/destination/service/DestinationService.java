package com.tabitrace.destination.service;

import com.tabitrace.destination.dto.DestinationDtos.DestinationView;
import com.tabitrace.destination.dto.DestinationDtos.OfficialGuide;
import com.tabitrace.destination.mapper.DestinationMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/** 创建旅行时的目的地搜索：参考目的地 + 该城市是否有官方探索内容（地点 / 路线数量实时统计） */
@Service
public class DestinationService {
    public static final int MAX_LIMIT = 10;
    private final DestinationMapper mapper;
    public DestinationService(DestinationMapper mapper) { this.mapper = mapper; }

    public List<DestinationView> search(String q, int limit) {
        String query = normalize(q);
        return mapper.search(query, escapeLike(query), Math.max(1, Math.min(MAX_LIMIT, limit))).stream().map(r -> {
            OfficialGuide official = r.officialCode == null ? null
                    : new OfficialGuide(r.officialCode, r.officialName, mapper.countOfficialPlaces(r.officialName), mapper.countRoutes(r.officialCode), r.officialCover);
            return new DestinationView(r.id, r.name, r.nameEn, r.countryCode, r.countryName, r.latitude, r.longitude, r.timezone,
                    official == null ? null : official.coverImage(), official);
        }).toList();
    }

    /** 去掉首尾空白并限制长度，避免超长查询 */
    static String normalize(String q) {
        if (q == null) return "";
        String v = q.strip();
        return v.length() > 50 ? v.substring(0, 50) : v;
    }

    /** LIKE 中的 \ % _ 按字面匹配 */
    static String escapeLike(String q) {
        return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
