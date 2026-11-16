package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/v1/support/messages")
public class SupportController {
    private final SupportService service;
    public SupportController(SupportService service){this.service=service;}
    @GetMapping public ApiResponse<List<MessageView>> list(){return ApiResponse.ok(service.list(SecurityUtils.currentUser().id()));}
    @PostMapping public ApiResponse<MessageView> send(@Valid @RequestBody MessageRequest r){return ApiResponse.ok(service.send(SecurityUtils.currentUser().id(),r));}
}
