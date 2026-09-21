package com.tabitrace.trip.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class TripEntity {
    public Long id;
    public Long userId;
    public String title;
    public String destinationName;
    public String countryCode;
    public String city;
    public LocalDate startDate;
    public LocalDate endDate;
    public Integer peopleCount;
    public String coverImage;
    public String planType;
    public String status;
    public String visibility;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
