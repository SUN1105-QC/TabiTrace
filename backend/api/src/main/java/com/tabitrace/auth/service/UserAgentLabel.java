package com.tabitrace.auth.service;

/** 把 User-Agent 归纳成“浏览器 · 系统”，只用于在已登录设备列表里辨认设备 */
public final class UserAgentLabel {
    private UserAgentLabel() {}

    public record Device(String label, boolean mobile) {}

    public static Device parse(String ua) {
        if (ua == null || ua.isBlank()) return new Device("未知设备", false);
        String browser = ua.contains("Edg/") ? "Edge"
                : ua.contains("OPR/") ? "Opera"
                : ua.contains("Firefox/") ? "Firefox"
                : ua.contains("Chrome/") || ua.contains("CriOS/") ? "Chrome"
                : ua.contains("Safari/") ? "Safari"
                : null;
        String os = ua.contains("iPhone") ? "iPhone"
                : ua.contains("iPad") ? "iPad"
                : ua.contains("Android") ? "Android"
                : ua.contains("Windows") ? "Windows"
                : ua.contains("Mac OS X") || ua.contains("Macintosh") ? "macOS"
                : ua.contains("Linux") ? "Linux"
                : null;
        boolean mobile = ua.contains("Mobile") || ua.contains("iPhone") || ua.contains("Android");
        if (browser == null && os == null) return new Device("其他客户端", false);
        if (browser == null) return new Device(os, mobile);
        if (os == null) return new Device(browser, mobile);
        return new Device(browser + " · " + os, mobile);
    }
}
