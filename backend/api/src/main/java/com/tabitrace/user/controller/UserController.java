package com.tabitrace.user.controller;

import com.tabitrace.auth.dto.AuthDtos.UserView;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.auth.service.RefreshCookies;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import com.tabitrace.security.SecurityUtils;
import com.tabitrace.security.UserPrincipal;
import com.tabitrace.user.dto.UserDtos.*;
import com.tabitrace.user.service.AccountDeletionService;
import com.tabitrace.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 所有接口只作用于当前登录用户，userId 来自访问令牌 */
@RestController
@RequestMapping("/api/v1/users/me")
public class UserController {
    private final UserService service; private final AuthService auth; private final RefreshCookies cookies; private final AccountDeletionService deletion;
    public UserController(UserService service, AuthService auth, RefreshCookies cookies, AccountDeletionService deletion){this.service=service;this.auth=auth;this.cookies=cookies;this.deletion=deletion;}

    /** 当前设备：访问令牌里的 sid；旧令牌没有 sid 时，用本机的 refresh Cookie（兼容请求体提交）识别 */
    private String currentJti(UserPrincipal p, String bodyToken, HttpServletRequest request){
        return auth.currentSessionJti(p.id(),p.sid(),bodyToken!=null&&!bodyToken.isBlank()?bodyToken:cookies.read(request));
    }

    @GetMapping public ApiResponse<UserView> me(){return ApiResponse.ok(service.get(SecurityUtils.currentUser().id()));}
    @PutMapping public ApiResponse<UserView> update(@Valid @RequestBody UpdateUserRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),r));}
    @GetMapping("/overview") public ApiResponse<AccountOverview> overview(){return ApiResponse.ok(service.overview(SecurityUtils.currentUser().id()));}

    @PostMapping("/avatar/presign") public ApiResponse<PresignResponse> presignAvatar(@Valid @RequestBody AvatarPresignRequest r){return ApiResponse.ok(service.presignAvatar(SecurityUtils.currentUser().id(),r));}
    @PutMapping("/avatar") public ApiResponse<UserView> setAvatar(@Valid @RequestBody AvatarRequest r){return ApiResponse.ok(service.setAvatar(SecurityUtils.currentUser().id(),r.storageKey(),r.smallKey()));}
    @DeleteMapping("/avatar") public ApiResponse<UserView> removeAvatar(){return ApiResponse.ok(service.removeAvatar(SecurityUtils.currentUser().id()));}

    @PostMapping("/password") public ApiResponse<Map<String,Integer>> changePassword(@Valid @RequestBody ChangePasswordRequest r,HttpServletRequest request){
        UserPrincipal p=SecurityUtils.currentUser();
        int signedOut=service.changePassword(p.id(),currentJti(p,r.refreshToken(),request),r);
        return ApiResponse.ok(Map.of("signedOutSessions",signedOut));
    }

    /** 注销账号：进入 7 天冷静期，所有设备立即退出（同时清掉本机的 refresh Cookie） */
    @PostMapping("/deletion") public ApiResponse<AccountDeletionView> requestDeletion(@Valid @RequestBody DeleteAccountRequest r,HttpServletResponse response){
        AccountDeletionView v=deletion.request(SecurityUtils.currentUser().id(),r);
        cookies.clear(response);
        return ApiResponse.ok(v);
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
    @PostMapping("/sessions/revoke-others") public ApiResponse<Map<String,Integer>> revokeOthers(@RequestBody(required=false) RevokeOthersRequest r,HttpServletRequest request){
        UserPrincipal p=SecurityUtils.currentUser();
        return ApiResponse.ok(Map.of("signedOutSessions",auth.revokeOtherSessions(p.id(),currentJti(p,r==null?null:r.refreshToken(),request))));
    }
}
