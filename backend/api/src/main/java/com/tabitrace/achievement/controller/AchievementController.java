package com.tabitrace.achievement.controller;

import com.tabitrace.achievement.dto.AchievementDtos.AchievementView;
import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.trip.service.TripService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/achievements")
public class AchievementController {
    private final AchievementService service;private final TripService trips;
    public AchievementController(AchievementService service,TripService trips){this.service=service;this.trips=trips;}
    @GetMapping public ApiResponse<List<AchievementView>> list(@PathVariable Long tripId){Long uid=SecurityUtils.currentUser().id();trips.requireOwned(uid,tripId);return ApiResponse.ok(service.list(uid,tripId));}
}
