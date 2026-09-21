package com.tabitrace.checkin.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CheckinEntity {
    public Long id;
    public Long tripId;
    public Long placeId;
    public Long userId;
    public Long itineraryItemId;
    public String checkinType;
    public LocalDateTime checkinTime;
    public BigDecimal latitude;
    public BigDecimal longitude;
    public String placeNameSnapshot;
    public String areaSnapshot;
    public String note;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
