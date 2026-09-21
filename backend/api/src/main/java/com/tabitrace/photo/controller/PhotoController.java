package com.tabitrace.photo.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.photo.dto.PhotoDtos.*;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PhotoController {
    private final PhotoService service;public PhotoController(PhotoService service){this.service=service;}
    @PostMapping("/trips/{tripId}/photos/presign") public ApiResponse<PresignResponse> presign(@PathVariable Long tripId,@Valid @RequestBody PresignRequest r){return ApiResponse.ok(service.presign(SecurityUtils.currentUser().id(),tripId,r));}
    @PostMapping("/trips/{tripId}/photos") public ApiResponse<PhotoView> register(@PathVariable Long tripId,@Valid @RequestBody RegisterPhotoRequest r){return ApiResponse.ok(service.register(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/photos") public ApiResponse<List<PhotoView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @PutMapping("/photos/{id}") public ApiResponse<PhotoView> update(@PathVariable Long id,@RequestBody UpdatePhotoRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @PostMapping("/photos/{id}/feature") public ApiResponse<PhotoView> feature(@PathVariable Long id){return ApiResponse.ok(service.feature(SecurityUtils.currentUser().id(),id,true));}
    @DeleteMapping("/photos/{id}/feature") public ApiResponse<PhotoView> unfeature(@PathVariable Long id){return ApiResponse.ok(service.feature(SecurityUtils.currentUser().id(),id,false));}
    @DeleteMapping("/photos/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
}
