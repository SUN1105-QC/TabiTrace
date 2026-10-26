package com.tabitrace.auth.controller;

import com.tabitrace.auth.dto.AuthDtos.*;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.auth.service.RefreshCookies;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.common.BusinessException;
import com.tabitrace.common.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.tabitrace.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/** 登录类接口：access token 放在响应 JSON 里（15 分钟），refresh token 只通过 HttpOnly Cookie 下发 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    private final RefreshCookies cookies;
    private final ClientIp clientIp;
    public AuthController(AuthService service, RefreshCookies cookies, ClientIp clientIp){this.service=service;this.cookies=cookies;this.clientIp=clientIp;}

    @PostMapping("/register") public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest r,@RequestHeader(value="User-Agent",required=false) String ua,HttpServletResponse res){return ApiResponse.ok(cookies.issue(service.register(r,ua),res));}
    @PostMapping("/login") public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest r,@RequestHeader(value="User-Agent",required=false) String ua,HttpServletRequest request,HttpServletResponse res){return ApiResponse.ok(cookies.issue(service.login(r,ua,clientIp.resolve(request)),res));}
    /** 忘记密码：先通过 /email-verification（purpose=reset_password）拿到令牌，再设置新密码 */
    @PostMapping("/password-reset") public ApiResponse<TokenResponse> resetPassword(@Valid @RequestBody PasswordResetRequest r,@RequestHeader(value="User-Agent",required=false) String ua,HttpServletResponse res){return ApiResponse.ok(cookies.issue(service.resetPassword(r,ua),res));}

    /** 刷新：从 Cookie 读取 refresh token（兼容旧客户端在请求体里提交）；失败时清掉无效 Cookie */
    @PostMapping("/refresh") public ApiResponse<TokenResponse> refresh(@RequestBody(required=false) RefreshRequest r,@RequestHeader(value="User-Agent",required=false) String ua,HttpServletRequest request,HttpServletResponse res){
        // 跨站来源直接拒绝，也不清 Cookie（不能让别的网站把用户登出）
        if(cookies.crossSite(request)) throw new BusinessException("CROSS_SITE_REQUEST","请求来源不被允许",HttpStatus.FORBIDDEN);
        String token=r!=null&&r.refreshToken()!=null&&!r.refreshToken().isBlank()?r.refreshToken():cookies.read(request);
        if(token==null){cookies.clear(res);throw new BusinessException("INVALID_REFRESH_TOKEN","登录状态已失效，请重新登录",HttpStatus.UNAUTHORIZED);}
        try{return ApiResponse.ok(cookies.issue(service.refresh(new RefreshRequest(token),ua),res));}
        // 已被轮换的旧 token（多个标签页同时刷新，后到的那个）不清 Cookie：否则会把先到的标签页刚写入的新 Cookie 覆盖掉，两个标签页一起被登出
        catch(BusinessException ex){if(ex.getStatus()==HttpStatus.UNAUTHORIZED&&!"REFRESH_TOKEN_REVOKED".equals(ex.getCode()))cookies.clear(res);throw ex;}
    }

    @PostMapping("/logout") public ApiResponse<Void> logout(@RequestBody(required=false) LogoutRequest r,HttpServletRequest request,HttpServletResponse res){
        if(cookies.crossSite(request)) throw new BusinessException("CROSS_SITE_REQUEST","请求来源不被允许",HttpStatus.FORBIDDEN);
        Long userId=null; String sid=null;
        Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication!=null && authentication.getPrincipal() instanceof UserPrincipal p) { userId=p.id(); sid=p.sid(); }
        String token=r!=null&&r.refreshToken()!=null&&!r.refreshToken().isBlank()?r.refreshToken():cookies.read(request);
        service.logout(userId,sid,new LogoutRequest(token));
        cookies.clear(res);
        return ApiResponse.ok();
    }
}
