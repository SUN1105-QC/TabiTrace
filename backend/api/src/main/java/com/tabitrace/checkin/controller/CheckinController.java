package com.tabitrace.checkin.controller;

import com.tabitrace.checkin.dto.CheckinDtos.*;
import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.checkin.service.QuickCheckinService;
import com.tabitrace.checkin.service.RecentRecordService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CheckinController {
    private final CheckinService service;private final RecentRecordService recentRecords;private final QuickCheckinService quick;
    public CheckinController(CheckinService service,RecentRecordService recentRecords,QuickCheckinService quick){this.service=service;this.recentRecords=recentRecords;this.quick=quick;}
    @PostMapping("/trips/{tripId}/checkins") public ApiResponse<CheckinView> create(@PathVariable Long tripId,@Valid @RequestBody CreateCheckinRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    /** 快速打卡：打卡 + 天气快照 + 照片元数据一次事务保存 */
    @PostMapping("/trips/{tripId}/quick-checkins") public ApiResponse<QuickCheckinResult> quick(@PathVariable Long tripId,@Valid @RequestBody QuickCheckinRequest r){return ApiResponse.ok(quick.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/checkins") public ApiResponse<List<CheckinView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/trips/{tripId}/timeline") public ApiResponse<List<TimelineDay>> timeline(@PathVariable Long tripId){return ApiResponse.ok(service.timeline(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/trips/{tripId}/recent-records") public ApiResponse<List<RecentRecord>> recent(@PathVariable Long tripId,@RequestParam(defaultValue="3") int limit){return ApiResponse.ok(recentRecords.recent(SecurityUtils.currentUser().id(),tripId,limit));}
    @PutMapping("/checkins/{id}") public ApiResponse<CheckinView> update(@PathVariable Long id,@Valid @RequestBody UpdateCheckinRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @DeleteMapping("/checkins/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
}
