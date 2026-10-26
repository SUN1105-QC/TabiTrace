package com.tabitrace.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 旅迹统一的邮件发送入口，两种通道：
 * - smtp（默认）：spring-boot-starter-mail，MAIL_HOST / MAIL_PORT / MAIL_USERNAME / MAIL_PASSWORD 配置；
 *   本地开发默认连 localhost:1025（backend/scripts/dev-mail-catcher.mjs 或 Mailpit）。
 * - resend：通过 HTTPS 调用 Resend API（RESEND_API_KEY）。适用于不允许出站 SMTP 的平台（如 Railway 非 Pro 套餐）。
 * 发送失败抛 MailDeliveryException，调用方必须据此返回真实失败，不能当作已发送。
 * 日志里只记录脱敏后的收件人与失败原因，不记录邮件正文（正文可能含验证码）与 API Key。
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private final JavaMailSender sender;
    private final String fromAddress;
    private final String fromName;
    private final String provider;
    private final String resendApiKey;
    private final String resendBaseUrl;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Autowired
    public MailService(JavaMailSender sender, ObjectMapper json,
                       @Value("${app.mail.from-address:no-reply@tabitrace.local}") String fromAddress,
                       @Value("${app.mail.from-name:旅迹 TabiTrace}") String fromName,
                       @Value("${app.mail.provider:smtp}") String provider,
                       @Value("${app.mail.resend.api-key:}") String resendApiKey,
                       @Value("${app.mail.resend.base-url:https://api.resend.com}") String resendBaseUrl) {
        this.sender = sender; this.json = json; this.fromAddress = fromAddress; this.fromName = fromName;
        this.provider = provider == null ? "smtp" : provider.trim().toLowerCase();
        this.resendApiKey = resendApiKey; this.resendBaseUrl = resendBaseUrl.replaceAll("/$", "");
    }

    public void send(String to, String subject, String text, String html) {
        if ("resend".equals(provider)) sendViaResend(to, subject, text, html);
        else sendViaSmtp(to, subject, text, html);
    }

    private void sendViaSmtp(String to, String subject, String text, String html) {
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            sender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            log.warn("EMAIL: SMTP 发送失败 to={} reason={}", mask(to), ex.getClass().getSimpleName() + ": " + ex.getMessage());
            throw new MailDeliveryException("邮件发送失败", ex);
        }
    }

    private void sendViaResend(String to, String subject, String text, String html) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            log.warn("EMAIL: MAIL_PROVIDER=resend 但没有配置 RESEND_API_KEY");
            throw new MailDeliveryException("邮件发送失败", null);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("from", fromName + " <" + fromAddress + ">");
            body.put("to", List.of(to));
            body.put("subject", subject);
            body.put("text", text);
            body.put("html", html);
            HttpRequest req = HttpRequest.newBuilder(URI.create(resendBaseUrl + "/emails"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + resendApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                // 响应体可能包含服务商的错误说明，只取前 200 字记录，不会包含验证码（验证码只在请求正文里）
                String reason = res.body() == null ? "" : res.body().substring(0, Math.min(200, res.body().length()));
                log.warn("EMAIL: Resend 发送失败 to={} status={} reason={}", mask(to), res.statusCode(), reason);
                throw new MailDeliveryException("邮件发送失败", null);
            }
        } catch (MailDeliveryException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new MailDeliveryException("邮件发送失败", ex);
        } catch (Exception ex) {
            log.warn("EMAIL: Resend 请求失败 to={} reason={}", mask(to), ex.getClass().getSimpleName());
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
