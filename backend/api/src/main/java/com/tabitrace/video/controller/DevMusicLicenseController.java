package com.tabitrace.video.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.video.dto.VideoDtos.MusicLicenseView;
import com.tabitrace.video.service.VideoService;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 开发环境的音乐版权后台：只在 local profile 注册，生产环境（prod）不存在这个接口 */
@RestController
@Profile("local")
public class DevMusicLicenseController {
    private final VideoService service;
    public DevMusicLicenseController(VideoService service) { this.service = service; }

    @GetMapping("/api/v1/dev/music-licenses")
    public ApiResponse<List<MusicLicenseView>> licenses() { return ApiResponse.ok(service.musicLicenses()); }
}
