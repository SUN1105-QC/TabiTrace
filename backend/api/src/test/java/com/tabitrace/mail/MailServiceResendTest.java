package com.tabitrace.mail;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** MAIL_PROVIDER=resend：通过 HTTPS API 发信；服务商报错时必须抛出失败，不能当作已发送 */
class MailServiceResendTest {
    HttpServer server;

    @AfterEach void stop() { if (server != null) server.stop(0); }

    private String start(int status, AtomicReference<String> body, AtomicReference<String> auth) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/emails", ex -> {
            body.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            auth.set(ex.getRequestHeaders().getFirst("Authorization"));
            byte[] out = "{\"id\":\"x\"}".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(status, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Test void sendsViaResendApi() throws Exception {
        AtomicReference<String> body = new AtomicReference<>(), auth = new AtomicReference<>();
        String base = start(200, body, auth);
        JavaMailSender smtp = mock(JavaMailSender.class);
        MailService mail = new MailService(smtp, new ObjectMapper(), "no-reply@example.com", "旅迹 TabiTrace", "resend", "re_test_key", base);
        mail.send("user@example.com", "验证码", "code 123456", "<p>code 123456</p>");
        assertEquals("Bearer re_test_key", auth.get());
        assertTrue(body.get().contains("\"to\":[\"user@example.com\"]"), body.get());
        assertTrue(body.get().contains("旅迹 TabiTrace <no-reply@example.com>"), body.get());
        verifyNoInteractions(smtp);
    }

    @Test void providerErrorIsARealFailure() throws Exception {
        String base = start(422, new AtomicReference<>(), new AtomicReference<>());
        MailService mail = new MailService(mock(JavaMailSender.class), new ObjectMapper(), "no-reply@example.com", "n", "resend", "re_test_key", base);
        assertThrows(MailDeliveryException.class, () -> mail.send("user@example.com", "s", "t", "h"));
        MailService noKey = new MailService(mock(JavaMailSender.class), new ObjectMapper(), "no-reply@example.com", "n", "resend", "", base);
        assertThrows(MailDeliveryException.class, () -> noKey.send("user@example.com", "s", "t", "h"));
    }
}
