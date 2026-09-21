package com.tabitrace.share.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.share.dto.ShareDtos.*;
import com.tabitrace.share.service.ShareService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ShareController {
    private final ShareService service;public ShareController(ShareService service){this.service=service;}
    @PostMapping("/trips/{tripId}/share-links") public ApiResponse<ShareLinkView> create(@PathVariable Long tripId,@RequestBody(required=false) CreateShareRequest r){return ApiResponse.ok(service.create(SecurityUtils.currentUser().id(),tripId,r));}
    @GetMapping("/trips/{tripId}/share-links") public ApiResponse<List<ShareLinkView>> list(@PathVariable Long tripId){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id(),tripId));}
    @DeleteMapping("/trips/{tripId}/share-links/{shareId}") public ApiResponse<Void> revoke(@PathVariable Long tripId,@PathVariable Long shareId){service.revoke(SecurityUtils.currentUser().id(),tripId,shareId);return ApiResponse.ok();}
    @GetMapping("/share/{token}") public ApiResponse<PublicShareView> publicView(@PathVariable String token){return ApiResponse.ok(service.publicView(token));}
}
