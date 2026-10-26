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
    /** 打卡时设备所在时区（IANA，例如 Asia/Tokyo）；旧数据为空 */
    public String timezone;
    public BigDecimal latitude;
    public BigDecimal longitude;
    public Integer locationAccuracyM;
    public String placeNameSnapshot;
    public String areaSnapshot;
    public String note;
    /** 打卡时刻的天气快照（WMO 天气代码、文字、气温、数据对应时刻、来源），拿不到时全部为空 */
    public Integer weatherCode;
    public String weatherText;
    public BigDecimal temperatureC;
    public LocalDateTime weatherObservedAt;
    public String weatherSource;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
