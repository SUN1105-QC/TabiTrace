package com.tabitrace.itinerary.dto;

import com.tabitrace.common.validation.Latitude;
import com.tabitrace.common.validation.Longitude;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.LocalTime;

public final class ItineraryDtos {
    private ItineraryDtos() {}
    public record UpsertItineraryRequest(Long placeId,@Size(max=200) String customPlaceName,@Size(max=100) String area,@NotNull LocalDate plannedDate,LocalTime plannedTime,@Size(max=2000) String note,@Latitude BigDecimal latitude,@Longitude BigDecimal longitude,String status,Integer sortOrder) {
        /** 经纬度要么同时提供，要么都不提供 */
        @AssertTrue(message="经纬度需要同时提供") public boolean isCoordinatePair(){return (latitude==null)==(longitude==null);}
    }
    public record ItineraryView(Long id,Long placeId,String placeName,String area,LocalDate plannedDate,LocalTime plannedTime,String note,BigDecimal latitude,BigDecimal longitude,String status,Integer sortOrder,LocalDateTime createdAt) {}
    public record ItineraryCheckinRequest(OffsetDateTime checkinTime,@Size(max=2000) String note) {}
}
