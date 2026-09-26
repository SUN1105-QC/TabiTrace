package com.tabitrace.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 取客户端 IP（用于频率限制）。
 * 生产环境由本机 nginx 反向代理并设置 X-Real-IP（见 deploy/nginx-tabitrace.conf），
 * 只有请求确实来自本机回环地址时才信任该头，外部直接请求伪造的 X-Real-IP 会被忽略。
 */
public final class ClientIp {
    private ClientIp() {}

    public static String resolve(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        if (isLoopback(remote)) {
            String real = request.getHeader("X-Real-IP");
            if (real != null && !real.isBlank() && real.length() <= 64) return real.trim();
        }
        return remote;
    }

    static boolean isLoopback(String ip) {
        return ip != null && (ip.equals("127.0.0.1") || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1"));
    }
}
