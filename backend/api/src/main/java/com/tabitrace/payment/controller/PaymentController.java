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
    @GetMapping("/payments") public ApiResponse<java.util.List<PaymentView>> history(){return ApiResponse.ok(service.history(SecurityUtils.currentUser().id()));}
    @GetMapping("/payments/{id}") public ApiResponse<PaymentView> get(@PathVariable Long id){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/payments/{id}/refresh") public ApiResponse<PaymentView> refresh(@PathVariable Long id){return ApiResponse.ok(service.refresh(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/payments/{id}/resume") public ApiResponse<CheckoutResponse> resume(@PathVariable Long id){return ApiResponse.ok(service.resume(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/payments/{id}/cancel") public ApiResponse<PaymentView> cancel(@PathVariable Long id){return ApiResponse.ok(service.cancel(SecurityUtils.currentUser().id(),id));}
    @PostMapping("/trips/{tripId}/payments/checkout") public ApiResponse<CheckoutResponse> checkout(@PathVariable Long tripId){return ApiResponse.ok(service.checkout(SecurityUtils.currentUser().id(),tripId));}
    /** 买断 · 终身 Pro */
    @PostMapping("/payments/lifetime/checkout") public ApiResponse<CheckoutResponse> lifetime(){return ApiResponse.ok(service.checkoutLifetime(SecurityUtils.currentUser().id()));}
    @GetMapping("/payments/lifetime/latest") public ApiResponse<PaymentView> lifetimeLatest(){return ApiResponse.ok(service.latestLifetime(SecurityUtils.currentUser().id()));}
    @GetMapping("/trips/{tripId}/payments/latest") public ApiResponse<PaymentView> latest(@PathVariable Long tripId){return ApiResponse.ok(service.latest(SecurityUtils.currentUser().id(),tripId));}
    @PostMapping(value="/payments/stripe/webhook",consumes=MediaType.APPLICATION_JSON_VALUE) public ApiResponse<Void> webhook(@RequestBody String body,@RequestHeader("Stripe-Signature") String signature){service.webhook(body,signature);return ApiResponse.ok();}
}
