package com.tabitrace.common;

import org.springframework.http.HttpStatus;

import java.util.Map;

public class BusinessException extends RuntimeException {
    private final String code;
    private final HttpStatus status;
    /** 可选的补充信息（例如 retryAfter、remainingAttempts），放进响应的 data 里，不含任何敏感值 */
    private final Map<String, Object> details;
    public BusinessException(String code, String message) { this(code, message, HttpStatus.BAD_REQUEST); }
    public BusinessException(String code, String message, HttpStatus status) { this(code, message, status, null); }
    public BusinessException(String code, String message, HttpStatus status, Map<String, Object> details) {
        super(message); this.code = code; this.status = status; this.details = details;
    }
    public String getCode() { return code; }
    public HttpStatus getStatus() { return status; }
    public Map<String, Object> getDetails() { return details; }
}
