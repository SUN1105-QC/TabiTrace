package com.tabitrace.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ClientIpTest {
    @Test void defaultOnlyTrustsRealIpFromLocalNginx() {
        assertEquals("203.0.113.9", ClientIp.resolve("127.0.0.1", "203.0.113.9", null, false));
        // 外部直接请求伪造的头被忽略
        assertEquals("198.51.100.4", ClientIp.resolve("198.51.100.4", "1.2.3.4", "1.2.3.4", false));
    }

    @Test void behindTrustedProxyUsesRightmostForwardedFor() {
        // 客户端自己写的 X-Forwarded-For 在左边，平台边缘代理追加的真实 IP 在最右边
        assertEquals("203.0.113.9", ClientIp.resolve("fd12::1", null, "1.2.3.4, 203.0.113.9", true));
        assertEquals("203.0.113.9", ClientIp.resolve("fd12::1", null, "203.0.113.9", true));
        assertEquals("fd12::1", ClientIp.resolve("fd12::1", null, null, true));
    }

    @Test void containerGatewayNeedsExplicitProxyTrust() {
        assertEquals("172.20.0.1",ClientIp.resolve("172.20.0.1","203.0.113.9","203.0.113.9",false));
        assertEquals("203.0.113.9",ClientIp.resolve("172.20.0.1","203.0.113.9","198.51.100.2,203.0.113.9",true));
    }

    @Test void emptyProxyHopListDoesNotCrashRequest() {
        assertEquals("172.20.0.1",ClientIp.resolve("172.20.0.1",null,",",true));
    }
}
