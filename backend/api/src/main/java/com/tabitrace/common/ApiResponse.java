package com.tabitrace.common;

public record ApiResponse<T>(boolean success, T data, String code, String message) {
    public static <T> ApiResponse<T> ok(T data) { return new ApiResponse<>(true, data, null, null); }
    public static ApiResponse<Void> ok() { return new ApiResponse<>(true, null, null, null); }
    public static ApiResponse<Void> error(String code, String message) { return new ApiResponse<>(false, null, code, message); }
    public static <T> ApiResponse<T> error(String code, String message, T data) { return new ApiResponse<>(false, data, code, message); }
}
