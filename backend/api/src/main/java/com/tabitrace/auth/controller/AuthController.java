package com.tabitrace.auth.controller;

import com.tabitrace.auth.dto.AuthDtos.*;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    public AuthController(AuthService service){this.service=service;}
    @PostMapping("/register") public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest r){return ApiResponse.ok(service.register(r));}
    @PostMapping("/login") public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest r){return ApiResponse.ok(service.login(r));}
    @PostMapping("/refresh") public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest r){return ApiResponse.ok(service.refresh(r));}
    @PostMapping("/logout") public ApiResponse<Void> logout(@RequestBody(required=false) LogoutRequest r){
        Long userId=null;
        Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication!=null && authentication.getPrincipal() instanceof UserPrincipal p) userId=p.id();
        service.logout(userId,r);
        return ApiResponse.ok();
    }
}
