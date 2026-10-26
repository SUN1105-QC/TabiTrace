package com.tabitrace.checkin.dto;

import com.tabitrace.common.validation.Latitude;
import com.tabitrace.common.validation.Longitude;
import jakarta.validation.constraints.AssertTrue;
import com.tabitrace.photo.dto.PhotoDtos.PhotoView;
import com.tabitrace.photo.dto.PhotoDtos.RegisterPhotoRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class CheckinDtos {
    private CheckinDtos() {}
    /** timezone：打卡时设备所在时区（IANA）；accuracyM：浏览器给出的定位精度（米）。两者都可省略 */
    public record CreateCheckinRequest(Long placeId,Long itineraryItemId,@NotNull OffsetDateTime checkinTime,@Latitude BigDecimal latitude,@Longitude BigDecimal longitude,@Size(max=200) String placeName,@Size(max=100) String area,@Size(max=4000) String note,@Size(max=64) String timezone,Integer accuracyM) {
        public CreateCheckinRequest(Long placeId,Long itineraryItemId,OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,String placeName,String area,String note){this(placeId,itineraryItemId,checkinTime,latitude,longitude,placeName,area,note,null,null);}
        /** 经纬度要么同时提供，要么都不提供 */
        @AssertTrue(message="经纬度需要同时提供") public boolean isCoordinatePair(){return (latitude==null)==(longitude==null);}
    }
    public record UpdateCheckinRequest(@NotNull OffsetDateTime checkinTime,@Latitude BigDecimal latitude,@Longitude BigDecimal longitude,@Size(max=200) String placeName,@Size(max=100) String area,@Size(max=4000) String note) {
        /** 经纬度要么同时提供，要么都不提供 */
        @AssertTrue(message="经纬度需要同时提供") public boolean isCoordinatePair(){return (latitude==null)==(longitude==null);}
    }
    public record CheckinView(Long id,Long tripId,Long placeId,Long itineraryItemId,String checkinType,OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,String placeName,String area,String note,OffsetDateTime createdAt,
                              String timezone,Integer weatherCode,String weatherText,BigDecimal temperatureC,OffsetDateTime weatherObservedAt) {
        public CheckinView(Long id,Long tripId,Long placeId,Long itineraryItemId,String checkinType,OffsetDateTime checkinTime,BigDecimal latitude,BigDecimal longitude,String placeName,String area,String note,OffsetDateTime createdAt){this(id,tripId,placeId,itineraryItemId,checkinType,checkinTime,latitude,longitude,placeName,area,note,createdAt,null,null,null,null,null);}
    }
    /** 快速打卡：打卡与照片在同一事务里保存；照片需先上传到存储（presign + PUT），这里只登记元数据 */
    public record QuickCheckinRequest(@NotNull @Valid CreateCheckinRequest checkin,@Size(max=9) List<@Valid RegisterPhotoRequest> photos,Boolean captureWeather) {}
    public record QuickCheckinResult(CheckinView checkin,List<PhotoView> photos) {}
    public record TimelinePhoto(Long id,String imageUrl,String caption,boolean featured,OffsetDateTime capturedAt,String thumbUrl,String mediumUrl) {
        public TimelinePhoto(Long id,String imageUrl,String caption,boolean featured,OffsetDateTime capturedAt){this(id,imageUrl,caption,featured,capturedAt,null,null);}
    }
    public record TimelineItem(CheckinView checkin,List<TimelinePhoto> photos) {}
    public record TimelineDay(LocalDate date,List<TimelineItem> items) {}
    /** 最近记录：kind=CHECKIN（一次打卡）或 PHOTOS（当天单独上传的照片）；时间为用户时区 */
    public record RecentRecord(String kind,Long checkinId,String placeName,String area,String checkinType,OffsetDateTime at,int photoCount,String thumbnailUrl,String note) {}
}
