package com.tabitrace.trip.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.trip.dto.TripDtos.*;
import com.tabitrace.trip.service.TripService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/trips")
public class TripController {
    private final TripService service; public TripController(TripService service){this.service=service;}
    @PostMapping public ApiResponse<TripView> create(@Valid @RequestBody CreateTripRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),r));}
    @GetMapping public ApiResponse<List<TripView>> list(){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id()));}
    @GetMapping("/{id}") public ApiResponse<TripView> get(@PathVariable Long id){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id(),id));}
    @PutMapping("/{id}") public ApiResponse<TripView> update(@PathVariable Long id,@Valid @RequestBody UpdateTripRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
    @PostMapping("/{id}/archive") public ApiResponse<TripView> archive(@PathVariable Long id){return ApiResponse.ok(service.archive(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/{id}/unarchive") public ApiResponse<TripView> unarchive(@PathVariable Long id){return ApiResponse.ok(service.unarchive(SecurityUtils.currentUser().id(),id));}
}
