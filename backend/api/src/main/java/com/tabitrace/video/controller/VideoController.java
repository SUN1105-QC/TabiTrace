package com.tabitrace.video.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.video.dto.VideoDtos.*;
import com.tabitrace.video.service.VideoService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class VideoController {
    private final VideoService service;public VideoController(VideoService service){this.service=service;}
    @PostMapping("/trips/{tripId}/video-projects") public ApiResponse<VideoProjectView> create(@PathVariable Long tripId,@Valid @RequestBody UpsertVideoProjectRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/video-projects") public ApiResponse<List<VideoProjectView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/video-projects/{id}") public ApiResponse<VideoProjectView> get(@PathVariable Long id){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id(),id));}
    @PutMapping("/video-projects/{id}") public ApiResponse<VideoProjectView> update(@PathVariable Long id,@Valid @RequestBody UpsertVideoProjectRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @PostMapping("/video-projects/{id}/render") public ApiResponse<VideoProjectView> render(@PathVariable Long id){return ApiResponse.ok(service.render(SecurityUtils.currentUser().id(),id));}
    @DeleteMapping("/video-projects/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
}
