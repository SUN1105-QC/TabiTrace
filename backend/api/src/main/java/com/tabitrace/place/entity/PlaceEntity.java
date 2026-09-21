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
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
