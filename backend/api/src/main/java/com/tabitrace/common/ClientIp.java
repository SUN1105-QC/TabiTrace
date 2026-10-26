package com.tabitrace.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 取客户端 IP（用于登录 / 验证码的频率限制）。
 *
 * - 默认（单机 nginx 部署）：只有请求确实来自本机回环地址时才信任 nginx 设置的 X-Real-IP，外部伪造的头会被忽略。
 * - app.client-ip.trust-forwarded-for=true（API 只能经由可信代理访问，例如 Railway 私网 + 前端同源代理）：
 *   取 X-Forwarded-For 最右侧一项——它由平台边缘代理追加，客户端自己写进去的值只会出现在左边。
 *   API 若同时对公网开放，不能开启此项，否则 IP 可以被伪造。
 */
@Component
public class ClientIp {
    private final boolean trustForwardedFor;

    public ClientIp(@Value("${app.client-ip.trust-forwarded-for:false}") boolean trustForwardedFor) {
        this.trustForwardedFor = trustForwardedFor;
    }

    public String resolve(HttpServletRequest request) {
        return resolve(request.getRemoteAddr(), request.getHeader("X-Real-IP"), request.getHeader("X-Forwarded-For"), trustForwardedFor);
    }

    static String resolve(String remote, String realIp, String forwardedFor, boolean trustForwardedFor) {
        if (trustForwardedFor && forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            String last = hops[hops.length - 1].trim();
            if (!last.isEmpty() && last.length() <= 64) return last;
        }
        if (isLoopback(remote) && realIp != null && !realIp.isBlank() && realIp.length() <= 64) return realIp.trim();
        return remote;
    }

    static boolean isLoopback(String ip) {
        return ip != null && (ip.equals("127.0.0.1") || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1"));
    }
}
