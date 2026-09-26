package com.tabitrace.verification;

import com.tabitrace.common.BusinessException;
import com.tabitrace.mail.MailDeliveryException;
import com.tabitrace.mail.MailService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.verification.entity.EmailVerificationEntity;
import com.tabitrace.verification.mapper.EmailVerificationMapper;
import com.tabitrace.verification.service.EmailVerificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailVerificationServiceTest {
    final EmailVerificationMapper mapper = mock(EmailVerificationMapper.class);
    final UserMapper users = mock(UserMapper.class);
    final MailService mail = mock(MailService.class);
    final EmailVerificationService service = new EmailVerificationService(mapper, users, mail,
        "0123456789012345678901234567890123456789", "http://localhost:3000/", 600, 60, 5, 1800, 5, 20);
    static final VerificationPurpose REG = VerificationPurpose.REGISTER;

    /** 与真实 MyBatis 一致：没有发送记录时返回 null（Mockito 对 Long 默认返回 0） */
    @BeforeEach
    void noPreviousSend() { when(mapper.secondsSinceLastSend(anyString(), anyString())).thenReturn(null); }

    private EmailVerificationEntity captureInsert() {
        ArgumentCaptor<EmailVerificationEntity> c = ArgumentCaptor.forClass(EmailVerificationEntity.class);
        verify(mapper).insert(c.capture(), eq(600L));
        return c.getValue();
    }

    private String sentCode() {
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(anyString(), anyString(), text.capture(), anyString());
        Matcher m = Pattern.compile("\\b(\\d{6})\\b").matcher(text.getValue());
        assertTrue(m.find(), "邮件正文应包含 6 位验证码");
        return m.group(1);
    }

    static String sha256(String v) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));
    }

    // ------------------------------------------------------------ send

    @Test
    void sendStoresOnlyAKeyedHashAndMailsTheCode() {
        doAnswer(inv -> { ((EmailVerificationEntity) inv.getArgument(0)).id = 7L; return 1; }).when(mapper).insert(any(), anyLong());
        EmailVerificationService.SendResult res = service.send("  New@Example.COM ", REG, "203.0.113.9");

        assertEquals(600, res.expiresIn());
        assertEquals(60, res.resendAfter());
        EmailVerificationEntity saved = captureInsert();
        assertEquals("new@example.com", saved.email);
        assertEquals("REGISTER", saved.purpose);
        assertEquals(5, saved.maxAttempts);
        assertNull(saved.invalidatedAt);
        assertTrue(saved.codeHash.matches("[0-9a-f]{64}"));
        String code = sentCode();
        assertNotEquals(code, saved.codeHash);
        assertFalse(saved.codeHash.contains(code));
        assertFalse(saved.requesterIpHash.contains("203.0.113.9"), "IP 也只保存哈希");
        verify(mail).send(eq("new@example.com"), eq("【旅迹】你的邮箱验证码"), anyString(), contains(code));
        verify(mapper).markSent(7L);
        verify(mapper).invalidateOthers("new@example.com", "REGISTER", 7L);
    }

    @Test
    void mailFailureInvalidatesTheRecordAndReportsARealFailure() {
        doAnswer(inv -> { ((EmailVerificationEntity) inv.getArgument(0)).id = 8L; return 1; }).when(mapper).insert(any(), anyLong());
        doThrow(new MailDeliveryException("down", new RuntimeException())).when(mail).send(any(), any(), any(), any());
        BusinessException ex = assertThrows(BusinessException.class, () -> service.send("a@example.com", REG, "1.1.1.1"));
        assertEquals("EMAIL_SEND_FAILED", ex.getCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        verify(mapper).markFailed(8L);
        verify(mapper, never()).markSent(any());
        verify(mapper, never()).invalidateOthers(any(), any(), any());
    }

    @Test
    void resendCooldownIsEnforcedOnTheServer() {
        when(mapper.secondsSinceLastSend("a@example.com", "REGISTER")).thenReturn(15L);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.send("a@example.com", REG, "1.1.1.1"));
        assertEquals("RESEND_TOO_SOON", ex.getCode());
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
        assertEquals(45L, ex.getDetails().get("retryAfter"));
        verify(mapper, never()).insert(any(), anyLong());
        verifyNoInteractions(mail);
    }

    @Test
    void concurrentDuplicateSendIsThrottledAfterInsert() {
        doAnswer(inv -> { ((EmailVerificationEntity) inv.getArgument(0)).id = 30L; return 1; }).when(mapper).insert(any(), anyLong());
        when(mapper.countEarlierSendsWithin("a@example.com", "REGISTER", 30L, 60L)).thenReturn(1);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.send("a@example.com", REG, "1.1.1.1"));
        assertEquals("RESEND_TOO_SOON", ex.getCode());
        verify(mapper).markThrottled(30L);
        verifyNoInteractions(mail);
        verify(mapper, never()).invalidateOthers(any(), any(), any());
    }

    @Test
    void hourlyLimitsPerEmailAndPerIp() {
        when(mapper.countByEmailSince(eq("a@example.com"), anyLong())).thenReturn(5);
        when(mapper.emailWindowResetSeconds(eq("a@example.com"), anyLong())).thenReturn(1200L);
        BusinessException byEmail = assertThrows(BusinessException.class, () -> service.send("a@example.com", REG, "1.1.1.1"));
        assertEquals("TOO_MANY_REQUESTS", byEmail.getCode());
        assertEquals(1200L, byEmail.getDetails().get("retryAfter"));

        when(mapper.countByIpSince(anyString(), anyLong())).thenReturn(20);
        BusinessException byIp = assertThrows(BusinessException.class, () -> service.send("b@example.com", REG, "1.1.1.1"));
        assertEquals("TOO_MANY_REQUESTS", byIp.getCode());
        verifyNoInteractions(mail);
    }

    @Test
    void registeredEmailGetsANoticeInsteadOfACodeWithTheSameResponse() {
        when(users.findByEmail("old@example.com")).thenReturn(new UserEntity());
        doAnswer(inv -> { ((EmailVerificationEntity) inv.getArgument(0)).id = 9L; return 1; }).when(mapper).insert(any(), anyLong());
        EmailVerificationService.SendResult res = service.send("old@example.com", REG, "1.1.1.1");
        assertEquals(new EmailVerificationService.SendResult(600, 60), res);
        EmailVerificationEntity saved = captureInsert();
        assertNotNull(saved.invalidatedAt, "提醒记录不能被用来验证");
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("old@example.com"), eq("【旅迹】这个邮箱已经有旅迹账号"), text.capture(), contains("http://localhost:3000/login"));
        assertFalse(Pattern.compile("\\b\\d{6}\\b").matcher(text.getValue()).find(), "提醒邮件里不能有验证码");
        verify(mapper).markSent(9L);
        verify(mapper, never()).invalidateOthers(any(), any(), any());
    }

    @Test
    void onlyEnabledPurposesAndValidEmails() {
        assertEquals("PURPOSE_NOT_SUPPORTED", assertThrows(BusinessException.class, () -> service.send("a@example.com", VerificationPurpose.RESET_PASSWORD, "1.1.1.1")).getCode());
        assertEquals("INVALID_EMAIL", assertThrows(BusinessException.class, () -> service.send("not-an-email", REG, "1.1.1.1")).getCode());
        assertEquals(VerificationPurpose.REGISTER, VerificationPurpose.parse("register"));
        assertThrows(BusinessException.class, () -> VerificationPurpose.parse("admin"));
    }

    // ------------------------------------------------------------ verify

    private EmailVerificationEntity pendingWith(String code, int attempts, boolean expired) {
        doAnswer(inv -> { ((EmailVerificationEntity) inv.getArgument(0)).id = 11L; return 1; }).when(mapper).insert(any(), anyLong());
        service.send("v@example.com", REG, "1.1.1.1");
        EmailVerificationEntity e = captureInsert();
        e.id = 11L; e.attempts = attempts; e.expired = expired; e.sendStatus = "SENT";
        when(mapper.lockPending("v@example.com", "REGISTER")).thenReturn(e);
        return e;
    }

    @Test
    void correctCodeIssuesATokenAndStoresOnlyItsHash() throws Exception {
        pendingWith(null, 0, false);
        String code = sentCode();
        EmailVerificationService.VerifyResult res = service.verify("V@example.com", code, REG);
        assertEquals(1800, res.expiresIn());
        assertTrue(res.emailVerificationToken().length() >= 40);
        verify(mapper).markVerified(11L, sha256(res.emailVerificationToken()), 1800L);
        verify(mapper, never()).incrementAttempts(any());
    }

    @Test
    void wrongCodesCountAttemptsAndLockAfterFive() {
        pendingWith(null, 0, false);
        String code = sentCode();
        String wrong = code.equals("000000") ? "111111" : "000000";
        BusinessException first = assertThrows(BusinessException.class, () -> service.verify("v@example.com", wrong, REG));
        assertEquals("CODE_INVALID", first.getCode());
        assertEquals(4, first.getDetails().get("remainingAttempts"));
        verify(mapper).incrementAttempts(11L);

        EmailVerificationEntity e = mapper.lockPending("v@example.com", "REGISTER");
        e.attempts = 4;
        assertEquals("CODE_LOCKED", assertThrows(BusinessException.class, () -> service.verify("v@example.com", wrong, REG)).getCode());
        e.attempts = 5; // 已锁定后即使输对也不行
        assertEquals("CODE_LOCKED", assertThrows(BusinessException.class, () -> service.verify("v@example.com", code, REG)).getCode());
        verify(mapper, never()).markVerified(any(), any(), anyLong());
    }

    @Test
    void expiredOrMissingCodes() {
        pendingWith(null, 0, true);
        String code = sentCode();
        assertEquals("CODE_EXPIRED", assertThrows(BusinessException.class, () -> service.verify("v@example.com", code, REG)).getCode());
        when(mapper.lockPending("v@example.com", "REGISTER")).thenReturn(null);
        assertEquals("CODE_INVALID", assertThrows(BusinessException.class, () -> service.verify("v@example.com", code, REG)).getCode());
    }

    @Test
    void codeIsBoundToEmailAndPurpose() {
        pendingWith(null, 0, false);
        String code = sentCode();
        // 同一个验证码拿去验证别的邮箱：取到的是那个邮箱自己的记录，哈希不匹配
        EmailVerificationEntity other = new EmailVerificationEntity();
        other.id = 12L; other.maxAttempts = 5; other.codeHash = "0".repeat(64);
        when(mapper.lockPending("other@example.com", "REGISTER")).thenReturn(other);
        assertEquals("CODE_INVALID", assertThrows(BusinessException.class, () -> service.verify("other@example.com", code, REG)).getCode());
    }

    // ------------------------------------------------------------ consume

    private EmailVerificationEntity tokenRecord(String email) {
        EmailVerificationEntity e = new EmailVerificationEntity();
        e.id = 21L; e.email = email; e.purpose = "REGISTER"; e.verifiedAt = LocalDateTime.now();
        when(mapper.lockByToken(anyString())).thenReturn(e);
        when(mapper.consume(21L)).thenReturn(1);
        return e;
    }

    @Test
    void tokenIsConsumedOnceForTheSameEmail() {
        tokenRecord("a@example.com");
        service.consume("tok", " A@Example.com ", REG);
        verify(mapper).consume(21L);
    }

    @Test
    void tokenFailures() {
        assertEquals("EMAIL_VERIFICATION_REQUIRED", assertThrows(BusinessException.class, () -> service.consume(null, "a@example.com", REG)).getCode());
        assertEquals("EMAIL_VERIFICATION_REQUIRED", assertThrows(BusinessException.class, () -> service.consume(" ", "a@example.com", REG)).getCode());

        when(mapper.lockByToken(anyString())).thenReturn(null);
        assertEquals("EMAIL_TOKEN_INVALID", assertThrows(BusinessException.class, () -> service.consume("fake", "a@example.com", REG)).getCode());

        EmailVerificationEntity e = tokenRecord("a@example.com");
        assertEquals("EMAIL_TOKEN_MISMATCH", assertThrows(BusinessException.class, () -> service.consume("tok", "b@example.com", REG)).getCode());
        e.purpose = "CHANGE_EMAIL";
        assertEquals("EMAIL_TOKEN_MISMATCH", assertThrows(BusinessException.class, () -> service.consume("tok", "a@example.com", REG)).getCode());
        e.purpose = "REGISTER"; e.tokenExpired = true;
        assertEquals("EMAIL_TOKEN_EXPIRED", assertThrows(BusinessException.class, () -> service.consume("tok", "a@example.com", REG)).getCode());
        e.tokenExpired = false; e.consumedAt = LocalDateTime.now();
        assertEquals("EMAIL_TOKEN_USED", assertThrows(BusinessException.class, () -> service.consume("tok", "a@example.com", REG)).getCode());
        e.consumedAt = null; e.invalidatedAt = LocalDateTime.now();
        assertEquals("EMAIL_TOKEN_INVALID", assertThrows(BusinessException.class, () -> service.consume("tok", "a@example.com", REG)).getCode());
        e.invalidatedAt = null;
        when(mapper.consume(21L)).thenReturn(0); // 并发的另一个请求先消费了
        assertEquals("EMAIL_TOKEN_USED", assertThrows(BusinessException.class, () -> service.consume("tok", "a@example.com", REG)).getCode());
    }
}
