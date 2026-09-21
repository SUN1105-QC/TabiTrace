package com.tabitrace.checkin.controller;

import com.tabitrace.checkin.dto.CheckinDtos.*;
import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CheckinController {
    private final CheckinService service;public CheckinController(CheckinService service){this.service=service;}
    @PostMapping("/trips/{tripId}/checkins") public ApiResponse<CheckinView> create(@PathVariable Long tripId,@Valid @RequestBody CreateCheckinRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/checkins") public ApiResponse<List<CheckinView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/trips/{tripId}/timeline") public ApiResponse<List<TimelineDay>> timeline(@PathVariable Long tripId){return ApiResponse.ok(service.timeline(SecurityUtils.currentUser().id(),tripId));}
    @PutMapping("/checkins/{id}") public ApiResponse<CheckinView> update(@PathVariable Long id,@Valid @RequestBody UpdateCheckinRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @DeleteMapping("/checkins/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
}
