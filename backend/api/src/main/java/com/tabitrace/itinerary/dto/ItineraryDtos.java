package com.tabitrace.itinerary.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.LocalTime;

public final class ItineraryDtos {
    private ItineraryDtos() {}
    public record UpsertItineraryRequest(Long placeId,@Size(max=200) String customPlaceName,@Size(max=100) String area,@NotNull LocalDate plannedDate,LocalTime plannedTime,@Size(max=2000) String note,BigDecimal latitude,BigDecimal longitude,String status,Integer sortOrder) {}
    public record ItineraryView(Long id,Long placeId,String placeName,String area,LocalDate plannedDate,LocalTime plannedTime,String note,BigDecimal latitude,BigDecimal longitude,String status,Integer sortOrder,LocalDateTime createdAt) {}
    public record ItineraryCheckinRequest(OffsetDateTime checkinTime,@Size(max=2000) String note) {}
}
