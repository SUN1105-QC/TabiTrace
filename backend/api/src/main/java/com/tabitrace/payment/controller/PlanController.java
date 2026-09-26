package com.tabitrace.payment.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.payment.service.PlanService;
import com.tabitrace.payment.service.PlanService.TripProPlan;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 公开接口：未登录也能在升级页看到真实的价格与方案差异 */
@RestController
@RequestMapping("/api/v1/plans")
public class PlanController {
    private final PlanService service;
    public PlanController(PlanService service) { this.service = service; }

    @GetMapping("/trip-pro") public ApiResponse<TripProPlan> tripPro() { return ApiResponse.ok(service.tripPro()); }
}
