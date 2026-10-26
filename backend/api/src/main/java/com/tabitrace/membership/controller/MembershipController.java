package com.tabitrace.membership.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.membership.service.MembershipService.MembershipView;
import com.tabitrace.security.SecurityUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/membership")
public class MembershipController {
    private final MembershipService service;
    public MembershipController(MembershipService service) { this.service = service; }

    /** 当前账号的会员状态（NONE / ACTIVE / EXPIRED）与可用的会员权益 */
    @GetMapping public ApiResponse<MembershipView> current() { return ApiResponse.ok(service.current(SecurityUtils.currentUser().id())); }
}
