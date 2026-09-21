package com.tabitrace.summary.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.summary.dto.SummaryDtos.TripSummary;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.dto.TripDtos.TripView;
import com.tabitrace.trip.service.TripService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/trips")
public class SummaryController {
    private final SummaryService summaries;private final TripService trips;
    public SummaryController(SummaryService summaries,TripService trips){this.summaries=summaries;this.trips=trips;}
    @GetMapping("/{id}/summary") public ApiResponse<TripSummary> summary(@PathVariable Long id){return ApiResponse.ok(summaries.get(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/{id}/complete") public ApiResponse<TripView> complete(@PathVariable Long id){return ApiResponse.ok(trips.complete(SecurityUtils.currentUser().id(),id));}
}
