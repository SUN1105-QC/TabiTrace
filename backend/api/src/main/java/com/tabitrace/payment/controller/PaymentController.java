package com.tabitrace.payment.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.payment.dto.PaymentDtos.*;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.security.SecurityUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class PaymentController {
    private final PaymentService service;public PaymentController(PaymentService service){this.service=service;}
    @PostMapping("/trips/{tripId}/payments/checkout") public ApiResponse<CheckoutResponse> checkout(@PathVariable Long tripId){return ApiResponse.ok(service.checkout(SecurityUtils.currentUser().id(),tripId));}
    @GetMapping("/trips/{tripId}/payments/latest") public ApiResponse<PaymentView> latest(@PathVariable Long tripId){return ApiResponse.ok(service.latest(SecurityUtils.currentUser().id(),tripId));}
    @PostMapping(value="/payments/stripe/webhook",consumes=MediaType.APPLICATION_JSON_VALUE) public ApiResponse<Void> webhook(@RequestBody String body,@RequestHeader("Stripe-Signature") String signature){service.webhook(body,signature);return ApiResponse.ok();}
}
