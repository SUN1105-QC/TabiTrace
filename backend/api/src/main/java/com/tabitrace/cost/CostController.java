package com.tabitrace.cost;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/usage")
public class CostController {
    private final CostControlService service;
    public CostController(CostControlService service){this.service=service;}
    @GetMapping public ApiResponse<CostControlService.Usage> usage(){return ApiResponse.ok(service.usage(SecurityUtils.currentUser().id()));}
}
