package com.tabitrace.auth.service;

import com.tabitrace.auth.dto.AuthDtos.TokenResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * refresh token（30 天有效的长期凭证）只通过 HttpOnly Cookie 下发和读取：
 * 前端 JavaScript 读不到它，XSS 也无法把它带走；响应 JSON 里不再包含 refresh token。
 * Cookie：HttpOnly、SameSite=Strict、Path=/api/v1，生产环境 Secure。
 */
@Component
public class RefreshCookies {
    private final String name;
    private final boolean secure;
    private final String sameSite;
    private final String path;
    private final Duration maxAge;

    public RefreshCookies(@Value("${app.auth.refresh-cookie.name:tt_refresh}") String name,
                          @Value("${app.auth.refresh-cookie.secure:false}") boolean secure,
                          @Value("${app.auth.refresh-cookie.same-site:Strict}") String sameSite,
                          @Value("${app.auth.refresh-cookie.path:/api/v1}") String path,
                          @Value("${app.jwt.refresh-ttl-days:30}") long refreshDays,
                          @Value("${app.cors.allowed-origins:http://localhost:3000}") String allowedOrigins) {
        this.name = name; this.secure = secure; this.sameSite = sameSite; this.path = path; this.maxAge = Duration.ofDays(refreshDays);
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).map(s -> s.replaceAll("/$", "")).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }
    private final Set<String> allowedOrigins;

    /** 把 refresh token 写进 Cookie，返回给前端的 JSON 去掉 refresh token */
    public TokenResponse issue(TokenResponse tokens, HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(tokens.refreshToken(), maxAge).toString());
        return new TokenResponse(tokens.accessToken(), null, tokens.expiresInSeconds(), tokens.user());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    /**
     * CSRF 纵深防御：refresh / logout 是仅凭 Cookie 生效的接口。SameSite=Strict 已经阻止跨站请求携带 Cookie，
     * 这里再按 Fetch Metadata 与 Origin 拒绝跨站来源（非浏览器客户端不带这两个头，也不会有受害者的 Cookie）。
     */
    public boolean crossSite(HttpServletRequest request) {
        // Fetch Metadata 由浏览器设置，页面脚本无法伪造：同源（含经 Next.js 同源转发）与用户直接访问放行，跨站拒绝；
        // same-site（例如开发环境 3000 → 8080、同一主域的其他子域）和不带该头的旧浏览器再按 Origin 白名单判断
        String site = request.getHeader("Sec-Fetch-Site");
        if (site != null && (site.equalsIgnoreCase("same-origin") || site.equalsIgnoreCase("none"))) return false;
        if (site != null && site.equalsIgnoreCase("cross-site")) return true;
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        return origin != null && !origin.isBlank() && !"null".equals(origin) && !allowedOrigins.contains(origin.replaceAll("/$", ""));
    }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) if (name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) return c.getValue();
        return null;
    }

    private ResponseCookie cookie(String value, Duration age) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(secure).sameSite(sameSite).path(path).maxAge(age).build();
    }
}
