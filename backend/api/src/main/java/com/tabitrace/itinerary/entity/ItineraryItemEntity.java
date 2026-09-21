package com.tabitrace.itinerary.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class ItineraryItemEntity {
    public Long id;
    public Long tripId;
    public Long placeId;
    public String customPlaceName;
    public String area;
    public LocalDate plannedDate;
    public LocalTime plannedTime;
    public String note;
    public BigDecimal latitude;
    public BigDecimal longitude;
    public String status;
    public Integer sortOrder;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
