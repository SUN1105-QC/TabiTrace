package com.tabitrace.mail;

/** 邮件没有成功交给 SMTP 服务器（连接、认证、收件人被拒等） */
public class MailDeliveryException extends RuntimeException {
    public MailDeliveryException(String message, Throwable cause) { super(message, cause); }
}
