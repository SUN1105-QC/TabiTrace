package com.tabitrace.auth;

import com.tabitrace.auth.dto.AuthDtos.TokenResponse;
import com.tabitrace.auth.service.RefreshCookies;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

/** refresh token 只放在 HttpOnly Cookie 里，响应 JSON 不再包含它 */
class RefreshCookiesTest {
    @Test void issueMovesRefreshTokenIntoHardenedCookie() {
        RefreshCookies cookies = new RefreshCookies("tt_refresh", true, "Strict", "/api/v1", 30, "https://tabitrace.example");
        MockHttpServletResponse res = new MockHttpServletResponse();
        TokenResponse out = cookies.issue(new TokenResponse("access", "refresh-secret", 900, null), res);
        assertNull(out.refreshToken());
        assertEquals("access", out.accessToken());
        String header = res.getHeader("Set-Cookie");
        assertNotNull(header);
        assertTrue(header.startsWith("tt_refresh=refresh-secret"));
        for (String attr : new String[]{"HttpOnly", "Secure", "SameSite=Strict", "Path=/api/v1", "Max-Age=2592000"}) assertTrue(header.contains(attr), attr);
    }

    @Test void clearExpiresCookieAndReadFindsIt() {
        RefreshCookies cookies = new RefreshCookies("tt_refresh", false, "Strict", "/api/v1", 30, "https://tabitrace.example");
        MockHttpServletResponse res = new MockHttpServletResponse();
        cookies.clear(res);
        assertTrue(res.getHeader("Set-Cookie").contains("Max-Age=0"));
        MockHttpServletRequest req = new MockHttpServletRequest();
        assertNull(cookies.read(req));
        req.setCookies(new Cookie("other", "x"), new Cookie("tt_refresh", "abc"));
        assertEquals("abc", cookies.read(req));
    }

    @Test void crossSiteRequestsAreRejected() {
        RefreshCookies cookies = new RefreshCookies("tt_refresh", true, "Strict", "/api/v1", 30, "https://tabitrace.example, http://localhost:3000/");
        MockHttpServletRequest same = new MockHttpServletRequest();
        same.addHeader("Origin", "https://tabitrace.example");
        same.addHeader("Sec-Fetch-Site", "same-origin");
        assertFalse(cookies.crossSite(same));
        MockHttpServletRequest dev = new MockHttpServletRequest();
        dev.addHeader("Origin", "http://localhost:3000");
        dev.addHeader("Sec-Fetch-Site", "same-site");
        assertFalse(cookies.crossSite(dev));
        assertFalse(cookies.crossSite(new MockHttpServletRequest()), "非浏览器客户端没有这些头");
        MockHttpServletRequest evil = new MockHttpServletRequest();
        evil.addHeader("Origin", "https://evil.example");
        assertTrue(cookies.crossSite(evil));
        MockHttpServletRequest fetchMeta = new MockHttpServletRequest();
        fetchMeta.addHeader("Sec-Fetch-Site", "cross-site");
        assertTrue(cookies.crossSite(fetchMeta));
        MockHttpServletRequest proxied = new MockHttpServletRequest();
        proxied.addHeader("Origin", "https://preview.tabitrace.example");
        proxied.addHeader("Sec-Fetch-Site", "same-origin");
        assertFalse(cookies.crossSite(proxied), "经网页同源转发的请求：浏览器判定同源即放行");
        MockHttpServletRequest sibling = new MockHttpServletRequest();
        sibling.addHeader("Origin", "https://other.tabitrace.example");
        sibling.addHeader("Sec-Fetch-Site", "same-site");
        assertTrue(cookies.crossSite(sibling), "同一主域的其他子域不在白名单里：拒绝");
    }
}
