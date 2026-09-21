package com.tabitrace.itinerary.controller;

import com.tabitrace.checkin.dto.CheckinDtos.CheckinView;
import com.tabitrace.checkin.service.CheckinService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.itinerary.dto.ItineraryDtos.*;
import com.tabitrace.itinerary.service.ItineraryService;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/itinerary")
public class ItineraryController {
    private final ItineraryService service; private final CheckinService checkins;
    public ItineraryController(ItineraryService service,CheckinService checkins){this.service=service;this.checkins=checkins;}
    @PostMapping public ApiResponse<ItineraryView> create(@PathVariable Long tripId,@Valid @RequestBody UpsertItineraryRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping public ApiResponse<List<ItineraryView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @PutMapping("/{itemId}") public ApiResponse<ItineraryView> update(@PathVariable Long tripId,@PathVariable Long itemId,@Valid @RequestBody UpsertItineraryRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),tripId,itemId,r));}
    @DeleteMapping("/{itemId}") public ApiResponse<Void> delete(@PathVariable Long tripId,@PathVariable Long itemId){service.delete(SecurityUtils.currentUser().id(),tripId,itemId);return ApiResponse.ok();}
    @PostMapping("/{itemId}/checkin") public ApiResponse<CheckinView> checkin(@PathVariable Long tripId,@PathVariable Long itemId,@RequestBody(required=false) ItineraryCheckinRequest r){return ApiResponse.ok(checkins.fromItinerary(SecurityUtils.currentUser().id(),tripId,itemId,r));}
}
