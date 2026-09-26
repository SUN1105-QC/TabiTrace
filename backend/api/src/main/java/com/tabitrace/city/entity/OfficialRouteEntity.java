package com.tabitrace.city.entity;

import java.time.LocalDateTime;

/** 官方专题路线：按游览顺序串起若干官方地点（place_ids 逗号分隔）。 */
public class OfficialRouteEntity {
    public Long id;
    public String cityCode;
    public String code;
    public String title;
    public String englishTitle;
    public String description;
    public String durationHint;
    public String season;
    public String coverImage;
    public String placeIds;
    public Integer sortOrder;
    public LocalDateTime createdAt;
}
