package com.tabitrace.place.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class PlaceEntity {
    public Long id;
    public String name;
    public String countryCode;
    public String country;
    public String city;
    public String area;
    public String address;
    public BigDecimal latitude;
    public BigDecimal longitude;
    public String category;
    public String sourceType;
    public String description;
    public String coverImage;
    /** 以下为探索指南的编辑内容（仅官方地点有值） */
    public String tagline;
    public String recommendReason;
    public Integer stayMinutes;
    public String bestTime;
    public String tags;
    public Integer editorRank;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
