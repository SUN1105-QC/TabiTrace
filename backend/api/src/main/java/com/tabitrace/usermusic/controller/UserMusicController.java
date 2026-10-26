package com.tabitrace.usermusic.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.usermusic.dto.UserMusicDtos.*;
import com.tabitrace.usermusic.service.UserMusicService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/**
 * 「我的音乐」。全部需要登录，且只能操作自己的音乐（其他人的音乐一律 404）。
 * 上传 / 重命名需要有效会员（后端检查，403 CUSTOM_MUSIC_REQUIRES_MEMBERSHIP）；查看、试听、删除不需要。
 */
@RestController
@RequestMapping("/api/v1/user/music")
public class UserMusicController {
    private final UserMusicService service;
    public UserMusicController(UserMusicService service) { this.service = service; }

    @GetMapping public ApiResponse<Library> library() { return ApiResponse.ok(service.library(uid())); }
    /** 申请上传地址（会员 + 版权确认 + 格式 / 大小 / 额度校验） */
    @PostMapping("/upload-url") public ApiResponse<UploadUrlResponse> uploadUrl(@Valid @RequestBody UploadUrlRequest r) { return ApiResponse.ok(service.uploadUrl(uid(), r)); }
    /** 文件已上传：登记并解析（READY / FAILED） */
    @PostMapping public ApiResponse<UserMusicView> complete(@Valid @RequestBody CompleteRequest r) { return ApiResponse.ok(service.complete(uid(), r.musicId())); }
    @PatchMapping("/{id}") public ApiResponse<UserMusicView> rename(@PathVariable Long id, @Valid @RequestBody RenameRequest r) { return ApiResponse.ok(service.rename(uid(), id, r.title())); }
    @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(uid(), id); return ApiResponse.ok(); }
    /** 限时试听地址（私有文件，不提供长期公开地址） */
    @GetMapping("/{id}/play-url") public ApiResponse<PlayUrl> playUrl(@PathVariable Long id) { return ApiResponse.ok(service.playUrl(uid(), id)); }

    private static Long uid() { return SecurityUtils.currentUser().id(); }
}
