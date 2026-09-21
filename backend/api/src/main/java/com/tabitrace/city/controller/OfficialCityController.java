package com.tabitrace.city.controller;

import com.tabitrace.city.dto.CityDtos.*;
import com.tabitrace.city.service.OfficialCityService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.place.dto.PlaceDtos.PlaceView;
import com.tabitrace.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class OfficialCityController {
    private final OfficialCityService service;public OfficialCityController(OfficialCityService service){this.service=service;}
    @GetMapping("/official-cities") public ApiResponse<List<OfficialCityView>> list(){return ApiResponse.ok(service.list());}
    @GetMapping("/official-cities/{code}") public ApiResponse<OfficialCityDetail> detail(@PathVariable String code){return ApiResponse.ok(service.detail(code));}
    @GetMapping("/official-cities/{code}/places") public ApiResponse<List<PlaceView>> places(@PathVariable String code){return ApiResponse.ok(service.places(code));}
    @PostMapping("/trips/{tripId}/official-places/{placeId}") public ApiResponse<PlaceView> add(@PathVariable Long tripId,@PathVariable Long placeId){return ApiResponse.ok(service.addToTrip(SecurityUtils.currentUser().id(),tripId,placeId));}
}
