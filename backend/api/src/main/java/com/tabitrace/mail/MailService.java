package com.tabitrace.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;

/**
 * 旅迹统一的邮件发送入口，基于项目已有的 spring-boot-starter-mail（SMTP）。
 * SMTP 服务器通过 MAIL_HOST / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD 等环境变量配置；
 * 本地开发默认连 localhost:1025（backend/scripts/dev-mail-catcher.mjs 或 Mailpit）。
 * 发送失败抛 MailDeliveryException，调用方必须据此返回真实失败，不能当作已发送。
 * 日志里只记录脱敏后的收件人与失败原因，不记录邮件正文（正文可能含验证码）。
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private final JavaMailSender sender;
    private final String fromAddress;
    private final String fromName;

    public MailService(JavaMailSender sender,
                       @Value("${app.mail.from-address:no-reply@tabitrace.local}") String fromAddress,
                       @Value("${app.mail.from-name:旅迹 TabiTrace}") String fromName) {
        this.sender = sender; this.fromAddress = fromAddress; this.fromName = fromName;
    }

    public void send(String to, String subject, String text, String html) {
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            sender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            log.warn("邮件发送失败 to={} reason={}", mask(to), ex.getClass().getSimpleName() + ": " + ex.getMessage());
            throw new MailDeliveryException("邮件发送失败", ex);
        }
    }

    /** a***@example.com */
    public static String mask(String email) {
        if (email == null) return "";
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
