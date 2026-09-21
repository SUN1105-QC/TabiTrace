package com.tabitrace.trip.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class TripDtos {
    private TripDtos() {}
    public record CreateTripRequest(@NotBlank @Size(max=200) String title,@NotBlank @Size(max=200) String destinationName,@Size(max=10) String countryCode,@Size(max=100) String city,@NotNull LocalDate startDate,@NotNull LocalDate endDate,@Min(1) @Max(100) Integer peopleCount,@Size(max=500) String coverImage,Boolean joinOfficialExplore) {}
    public record UpdateTripRequest(@NotBlank @Size(max=200) String title,@NotBlank @Size(max=200) String destinationName,@Size(max=10) String countryCode,@Size(max=100) String city,@NotNull LocalDate startDate,@NotNull LocalDate endDate,@Min(1) @Max(100) Integer peopleCount,@Size(max=500) String coverImage) {}
    public record TripView(Long id,String title,String destinationName,String countryCode,String city,LocalDate startDate,LocalDate endDate,Integer peopleCount,String coverImage,String planType,String status,String visibility,LocalDateTime createdAt) {}
}
