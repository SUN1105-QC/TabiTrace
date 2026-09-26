package com.tabitrace.auth;

import com.tabitrace.auth.dto.AuthDtos.RegisterRequest;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.verification.VerificationPurpose;
import com.tabitrace.verification.service.EmailVerificationService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthRegisterTest {
    final JwtService jwt = new JwtService("0123456789012345678901234567890123456789", 15, 30);
    final UserMapper users = mock(UserMapper.class);
    final PasswordEncoder encoder = mock(PasswordEncoder.class);
    final EmailVerificationService verifications = mock(EmailVerificationService.class);
    final AuthService service = new AuthService(users, mock(RefreshTokenMapper.class), encoder, jwt, verifications);
    final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    static RegisterRequest req(String email, String password, String nickname) { return new RegisterRequest(email, password, nickname, "token-1"); }

    private UserEntity captureInserted(RegisterRequest r) {
        when(users.findByEmail(any())).thenReturn(null);
        when(encoder.encode(any())).thenReturn("hash");
        UserEntity[] saved = new UserEntity[1];
        doAnswer(inv -> { saved[0] = inv.getArgument(0); saved[0].id = 42L; saved[0].status = "ACTIVE"; return 1; }).when(users).insert(any());
        when(users.findById(42L)).thenAnswer(inv -> saved[0]);
        service.register(r);
        return saved[0];
    }

    @Test
    void nicknameFollowsProfileRules() {
        assertEquals("旅 行者", captureInserted(req("a@example.test", "password1", "  旅   行者 ")).nickname);
        assertThrows(BusinessException.class, () -> captureInserted(req("b@example.test", "password1", "字".repeat(31))));
    }

    @Test
    void blankNicknameFallsBackToEmailPrefixCappedAt30() {
        assertEquals("traveler", captureInserted(req("Traveler@Example.test", "password1", " ")).nickname);
        assertEquals("x".repeat(30), captureInserted(req("x".repeat(40) + "@example.test", "password1", null)).nickname);
    }

    @Test
    void verificationTokenIsConsumedForTheNormalizedEmailBeforeTheUserIsCreated() {
        captureInserted(new RegisterRequest(" New@Example.test ", "password1", "n", "tok-xyz"));
        InOrder order = inOrder(verifications, users);
        order.verify(verifications).consume("tok-xyz", "new@example.test", VerificationPurpose.REGISTER);
        order.verify(users).insert(any());
    }

    @Test
    void failedVerificationNeverCreatesAUser() {
        doThrow(new BusinessException("EMAIL_VERIFICATION_REQUIRED", "请先完成邮箱验证"))
            .when(verifications).consume(any(), any(), any());
        BusinessException ex = assertThrows(BusinessException.class, () -> service.register(new RegisterRequest("a@example.test", "password1", "n", null)));
        assertEquals("EMAIL_VERIFICATION_REQUIRED", ex.getCode());
        verify(users, never()).insert(any());
    }

    @Test
    void existingEmailIsRejectedAfterOwnershipIsProven() {
        when(users.findByEmail("dup@example.test")).thenReturn(new UserEntity());
        BusinessException ex = assertThrows(BusinessException.class, () -> service.register(req(" Dup@Example.test ", "password1", "n")));
        assertEquals("EMAIL_EXISTS", ex.getCode());
        verify(verifications).consume(eq("token-1"), eq("dup@example.test"), eq(VerificationPurpose.REGISTER));
        verify(users, never()).insert(any());
    }

    @Test
    void concurrentDuplicateInsertIsReportedAsEmailExists() {
        when(users.findByEmail(any())).thenReturn(null);
        when(encoder.encode(any())).thenReturn("hash");
        when(users.insert(any())).thenThrow(new DuplicateKeyException("Duplicate entry for key users.email"));
        BusinessException ex = assertThrows(BusinessException.class, () -> service.register(req("race@example.test", "password1", "n")));
        assertEquals("EMAIL_EXISTS", ex.getCode());
    }

    @Test
    void passwordRulesMatchChangePassword() {
        assertFalse(validator.validate(req("a@example.test", null, "n")).isEmpty());
        assertFalse(validator.validate(req("a@example.test", "1234567", "n")).isEmpty());
        assertFalse(validator.validate(req("a@example.test", "        ", "n")).isEmpty());
        assertFalse(validator.validate(req("a@example.test", "p".repeat(101), "n")).isEmpty());
        assertTrue(validator.validate(req("a@example.test", "12345678", "n")).isEmpty());
        assertTrue(validator.validate(req("a@example.test", "abcdefgh", null)).isEmpty());
    }
}
