package com.tabitrace.place.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.place.dto.PlaceDtos.*;
import com.tabitrace.place.service.PlaceService;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PlaceController {
    private final PlaceService service; public PlaceController(PlaceService service){this.service=service;}
    @GetMapping("/trips/{tripId}/places") public ApiResponse<List<PlaceView>> tripPlaces(@PathVariable Long tripId){return ApiResponse.ok(service.listTrip(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/places/search") public ApiResponse<List<PlaceView>> search(@RequestParam(defaultValue="") String q){return ApiResponse.ok(service.search(q));}
    @GetMapping("/places/{id}") public ApiResponse<PlaceView> get(@PathVariable Long id){return ApiResponse.ok(service.get(id));}
    @PostMapping("/trips/{tripId}/places") public ApiResponse<PlaceView> add(@PathVariable Long tripId,@RequestBody AddPlaceRequest r){return ApiResponse.ok(service.addExisting(SecurityUtils.currentUser().id(),tripId,r.placeId(),r.sortOrder()));}
    @PostMapping("/trips/{tripId}/places/custom") public ApiResponse<PlaceView> custom(@PathVariable Long tripId,@Valid @RequestBody CustomPlaceRequest r){return ApiResponse.ok(service.addCustom(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/me/favorite-places") public ApiResponse<List<Long>> favorites(){return ApiResponse.ok(service.favorites(SecurityUtils.currentUser().id()));}
    @PostMapping("/places/{id}/favorite") public ApiResponse<Void> favorite(@PathVariable Long id){service.favorite(SecurityUtils.currentUser().id(),id,true);return ApiResponse.ok();}
    @DeleteMapping("/places/{id}/favorite") public ApiResponse<Void> unfavorite(@PathVariable Long id){service.favorite(SecurityUtils.currentUser().id(),id,false);return ApiResponse.ok();}
    @DeleteMapping("/trips/{tripId}/places/{placeId}") public ApiResponse<Void> remove(@PathVariable Long tripId,@PathVariable Long placeId){service.remove(SecurityUtils.currentUser().id(),tripId,placeId);return ApiResponse.ok();}
}
