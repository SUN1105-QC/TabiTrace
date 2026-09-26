package com.tabitrace.verification.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.common.ClientIp;
import com.tabitrace.verification.VerificationPurpose;
import com.tabitrace.verification.dto.EmailVerificationDtos.*;
import com.tabitrace.verification.service.EmailVerificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/** 公开接口（/api/v1/auth/** 已在 SecurityConfig 中放行） */
@RestController
@RequestMapping("/api/v1/auth/email-verification")
public class EmailVerificationController {
    private final EmailVerificationService service;
    public EmailVerificationController(EmailVerificationService service) { this.service = service; }

    @PostMapping("/send")
    public ApiResponse<SendCodeResponse> send(@Valid @RequestBody SendCodeRequest r, HttpServletRequest request) {
        EmailVerificationService.SendResult res = service.send(r.email(), VerificationPurpose.parse(r.purpose()), ClientIp.resolve(request));
        return ApiResponse.ok(new SendCodeResponse(res.expiresIn(), res.resendAfter()));
    }

    @PostMapping("/verify")
    public ApiResponse<VerifyCodeResponse> verify(@Valid @RequestBody VerifyCodeRequest r) {
        EmailVerificationService.VerifyResult res = service.verify(r.email(), r.code(), VerificationPurpose.parse(r.purpose()));
        return ApiResponse.ok(new VerifyCodeResponse(res.emailVerificationToken(), res.expiresIn()));
    }
}
