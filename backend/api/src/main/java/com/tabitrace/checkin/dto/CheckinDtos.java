package com.tabitrace.checkin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class CheckinDtos {
    private CheckinDtos() {}
    public record CreateCheckinRequest(Long placeId,Long itineraryItemId,@NotNull OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,@Size(max=200) String placeName,@Size(max=100) String area,@Size(max=4000) String note) {}
    public record UpdateCheckinRequest(@NotNull OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,@Size(max=200) String placeName,@Size(max=100) String area,@Size(max=4000) String note) {}
    public record CheckinView(Long id,Long tripId,Long placeId,Long itineraryItemId,String checkinType,OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,String placeName,String area,String note,OffsetDateTime createdAt) {}
    public record TimelinePhoto(Long id,String imageUrl,String caption,boolean featured,OffsetDateTime capturedAt) {}
    public record TimelineItem(CheckinView checkin,List<TimelinePhoto> photos) {}
    public record TimelineDay(LocalDate date,List<TimelineItem> items) {}
    /** 最近记录：kind=CHECKIN（一次打卡）或 PHOTOS（当天单独上传的照片）；时间为用户时区 */
    public record RecentRecord(String kind,Long checkinId,String placeName,String area,String checkinType,OffsetDateTime at,int photoCount,String thumbnailUrl,String note) {}
}
