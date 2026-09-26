package com.tabitrace.checkin.service;

import com.tabitrace.checkin.dto.CheckinDtos.RecentRecord;
import com.tabitrace.photo.entity.PhotoEntity;

import java.time.ZoneId;
import java.util.List;

/** 测试入口：暴露包内的纯函数 */
public final class RecentRecordServiceTestAccess {
    private RecentRecordServiceTestAccess() {}
    public static List<RecentRecord> group(List<PhotoEntity> list, ZoneId zone) { return RecentRecordService.groupUnattached(list, zone); }
    public static List<RecentRecord> merge(List<RecentRecord> all, int n) { return RecentRecordService.merge(all, n); }
}
