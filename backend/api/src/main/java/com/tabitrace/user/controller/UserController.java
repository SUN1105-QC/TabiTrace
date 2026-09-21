package com.tabitrace.user.controller;

import com.tabitrace.auth.dto.AuthDtos.UserView;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.user.dto.UserDtos.UpdateUserRequest;
import com.tabitrace.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final UserService service; public UserController(UserService service){this.service=service;}
    @GetMapping("/me") public ApiResponse<UserView> me(){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id()));}
    @PutMapping("/me") public ApiResponse<UserView> update(@Valid @RequestBody UpdateUserRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),r));}
}
