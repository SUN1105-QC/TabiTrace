package com.tabitrace.user.controller;

import com.tabitrace.auth.dto.AuthDtos.UserView;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.security.UserPrincipal;
import com.tabitrace.user.dto.UserDtos.*;
import com.tabitrace.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 所有接口只作用于当前登录用户，userId 来自访问令牌 */
@RestController
@RequestMapping("/api/v1/users/me")
public class UserController {
    private final UserService service; private final AuthService auth;
    public UserController(UserService service, AuthService auth){this.service=service;this.auth=auth;}

    @GetMapping public ApiResponse<UserView> me(){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id()));}
    @PutMapping public ApiResponse<UserView> update(@Valid @RequestBody UpdateUserRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),r));}
    @GetMapping("/overview") public ApiResponse<AccountOverview> overview(){return ApiResponse.ok(service.overview(SecurityUtils.currentUser().id()));}

    @PostMapping("/avatar/presign") public ApiResponse<PresignResponse> presignAvatar(@Valid @RequestBody AvatarPresignRequest r){return ApiResponse.ok(service.presignAvatar(SecurityUtils.currentUser().id(),r));}
    @PutMapping("/avatar") public ApiResponse<UserView> setAvatar(@Valid @RequestBody AvatarRequest r){return ApiResponse.ok(service.setAvatar(SecurityUtils.currentUser().id(),r.storageKey()));}
    @DeleteMapping("/avatar") public ApiResponse<UserView> removeAvatar(){return ApiResponse.ok(service.removeAvatar(SecurityUtils.currentUser().id()));}

    @PostMapping("/password") public ApiResponse<Map<String,Integer>> changePassword(@Valid @RequestBody ChangePasswordRequest r){
        UserPrincipal p=SecurityUtils.currentUser();
        int signedOut=service.changePassword(p.id(),auth.currentSessionJti(p.id(),p.sid(),r.refreshToken()),r);
        return ApiResponse.ok(Map.of("signedOutSessions",signedOut));
    }

    @GetMapping("/sessions") public ApiResponse<List<SessionView>> sessions(){
        UserPrincipal p=SecurityUtils.currentUser();
        return ApiResponse.ok(auth.sessions(p.id(),auth.currentSessionJti(p.id(),p.sid(),null)));
    }
    @DeleteMapping("/sessions/{id}") public ApiResponse<Void> revokeSession(@PathVariable Long id){
        UserPrincipal p=SecurityUtils.currentUser();
        auth.revokeSession(p.id(),id,auth.currentSessionJti(p.id(),p.sid(),null));
        return ApiResponse.ok();
    }
    @PostMapping("/sessions/revoke-others") public ApiResponse<Map<String,Integer>> revokeOthers(@RequestBody(required=false) RevokeOthersRequest r){
        UserPrincipal p=SecurityUtils.currentUser();
        return ApiResponse.ok(Map.of("signedOutSessions",auth.revokeOtherSessions(p.id(),auth.currentSessionJti(p.id(),p.sid(),r==null?null:r.refreshToken()))));
    }
}
