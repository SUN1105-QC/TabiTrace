package com.tabitrace.user.service;

import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.user.dto.UserDtos.AvatarPresignRequest;
import com.tabitrace.user.dto.UserDtos.ChangePasswordRequest;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.AccountMapper;
import com.tabitrace.user.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserServiceAccountTest {
    UserMapper users; RefreshTokenMapper tokens; PasswordEncoder encoder; StorageService storage; UserService service;

    @BeforeEach
    void setUp() {
        users = mock(UserMapper.class); tokens = mock(RefreshTokenMapper.class); encoder = mock(PasswordEncoder.class); storage = mock(StorageService.class);
        service = new UserService(users, mock(AccountMapper.class), tokens, encoder, storage);
        UserEntity u = new UserEntity(); u.id = 7L; u.email = "a@example.test"; u.nickname = "A"; u.passwordHash = "hash";
        when(users.findById(7L)).thenReturn(u);
    }

    @Test
    void wrongCurrentPasswordIsRejectedWithoutChangingAnything() {
        when(encoder.matches("wrong", "hash")).thenReturn(false);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.changePassword(7L, "jti-now", new ChangePasswordRequest("wrong", "new-password-1", null)));
        assertEquals("INVALID_PASSWORD", ex.getCode());
        verify(users, never()).updatePassword(any(), any());
        verifyNoInteractions(tokens);
    }

    @Test
    void passwordChangeKeepsCurrentDeviceAndSignsOutOthers() {
        when(encoder.matches("old-password", "hash")).thenReturn(true);
        when(encoder.matches("new-password-1", "hash")).thenReturn(false);
        when(encoder.encode("new-password-1")).thenReturn("new-hash");
        when(tokens.revokeOthers(7L, "jti-now")).thenReturn(2);
        assertEquals(2, service.changePassword(7L, "jti-now", new ChangePasswordRequest("old-password", "new-password-1", null)));
        verify(users).updatePassword(7L, "new-hash");
        verify(tokens, never()).revokeAll(any());
    }

    @Test
    void samePasswordIsRejected() {
        when(encoder.matches("old-password", "hash")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.changePassword(7L, "jti-now", new ChangePasswordRequest("old-password", "old-password", null)));
        verify(users, never()).updatePassword(any(), any());
    }

    @Test
    void avatarMustLiveInOwnFolderAndBeUploaded() {
        assertThrows(BusinessException.class, () -> service.setAvatar(7L, "users/8/avatar/x.jpg"));
        assertThrows(BusinessException.class, () -> service.setAvatar(7L, "users/7/avatar/../../8/x.jpg"));
        when(storage.exists("users/7/avatar/x.jpg")).thenReturn(false);
        assertThrows(BusinessException.class, () -> service.setAvatar(7L, "users/7/avatar/x.jpg"));
        when(storage.exists("users/7/avatar/y.jpg")).thenReturn(true);
        when(storage.publicUrl("users/7/avatar/y.jpg")).thenReturn("http://files/y.jpg");
        service.setAvatar(7L, "users/7/avatar/y.jpg");
        verify(users).updateAvatar(7L, "http://files/y.jpg");
    }

    @Test
    void avatarPresignOnlyAcceptsSmallWebImages() {
        assertThrows(BusinessException.class, () -> service.presignAvatar(7L, new AvatarPresignRequest("a.gif", "image/gif", 100L)));
        assertThrows(BusinessException.class, () -> service.presignAvatar(7L, new AvatarPresignRequest("a.jpg", "image/jpeg", 6L * 1024 * 1024)));
        service.presignAvatar(7L, new AvatarPresignRequest("a.jpg", "image/jpeg", 200_000L));
        verify(storage).presignKey(startsWith("users/7/avatar/"), eq("image/jpeg"));
    }
}
