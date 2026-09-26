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

    // 目录：模板与音乐都来自数据库，前端不再写死
    @GetMapping("/video-templates") public ApiResponse<List<VideoTemplateView>> templates(){return ApiResponse.ok(service.templates());}
    @GetMapping("/video-music") public ApiResponse<List<VideoMusicView>> music(){return ApiResponse.ok(service.music());}

    @PostMapping("/trips/{tripId}/video-projects") public ApiResponse<VideoProjectView> create(@PathVariable Long tripId,@Valid @RequestBody UpsertVideoProjectRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/video-projects") public ApiResponse<List<VideoProjectView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    /** 未保存设置的分镜预览 */
    @PostMapping("/trips/{tripId}/video-storyboard") public ApiResponse<StoryboardView> preview(@PathVariable Long tripId,@Valid @RequestBody UpsertVideoProjectRequest r){return ApiResponse.ok(service.preview(SecurityUtils.currentUser().id(),tripId,r));}

    @GetMapping("/video-projects/{id}") public ApiResponse<VideoProjectView> get(@PathVariable Long id){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id(),id));}
    @PutMapping("/video-projects/{id}") public ApiResponse<VideoProjectView> update(@PathVariable Long id,@Valid @RequestBody UpsertVideoProjectRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @GetMapping("/video-projects/{id}/storyboard") public ApiResponse<StoryboardView> storyboard(@PathVariable Long id){return ApiResponse.ok(service.storyboard(SecurityUtils.currentUser().id(),id));}
    /** 开始生成；FAILED 时即重试，COMPLETED 时即按原设置重新生成 */
    @PostMapping("/video-projects/{id}/render") public ApiResponse<VideoProjectView> render(@PathVariable Long id){return ApiResponse.ok(service.render(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/video-projects/{id}/duplicate") public ApiResponse<VideoProjectView> duplicate(@PathVariable Long id){return ApiResponse.ok(service.duplicate(SecurityUtils.currentUser().id(),id));}
    @DeleteMapping("/video-projects/{id}") public ApiResponse<Void> delete(@PathVariable Long id){service.delete(SecurityUtils.currentUser().id(),id);return ApiResponse.ok();}
}
