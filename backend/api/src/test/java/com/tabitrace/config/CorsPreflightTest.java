package com.tabitrace.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.CorsFilter;
import static org.junit.jupiter.api.Assertions.*;

class CorsPreflightTest {
    private MockHttpServletResponse preflight(String origin,String method) throws Exception {
        var request=new MockHttpServletRequest("OPTIONS","/api/v1/user-music/123");
        request.addHeader("Origin",origin);
        request.addHeader("Access-Control-Request-Method",method);
        request.addHeader("Access-Control-Request-Headers","authorization,content-type");
        var response=new MockHttpServletResponse();
        new CorsFilter(new SecurityConfig().corsConfigurationSource("http://localhost:3000"))
                .doFilter(request,response,new MockFilterChain());
        return response;
    }
    @Test void musicRenamePatchIsAllowedForConfiguredFrontend() throws Exception {
        var result=preflight("http://localhost:3000","PATCH");
        assertEquals(200,result.getStatus());
        assertEquals("http://localhost:3000",result.getHeader("Access-Control-Allow-Origin"));
        assertTrue(result.getHeader("Access-Control-Allow-Methods").contains("PATCH"));
    }
    @Test void untrustedOriginsAndUnsupportedMethodsStayBlocked() throws Exception {
        assertEquals(403,preflight("https://evil.example","PATCH").getStatus());
        assertEquals(403,preflight("http://localhost:3000","TRACE").getStatus());
    }
}
