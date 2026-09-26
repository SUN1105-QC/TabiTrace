package com.tabitrace.user.service;

import com.tabitrace.common.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UserSettingsRulesTest {
    @Test
    void nicknameIsTrimmedAndLengthChecked() {
        assertEquals("东京 散步", UserService.normalizeNickname("  东京   散步 "));
        assertThrows(BusinessException.class, () -> UserService.normalizeNickname("   "));
        assertEquals("旅".repeat(30), UserService.normalizeNickname("旅".repeat(30)));
        assertThrows(BusinessException.class, () -> UserService.normalizeNickname("旅".repeat(31)));
    }

    @Test
    void emptyBioBecomesNullAndLongBioIsRejected() {
        assertNull(UserService.normalizeBio("   "));
        assertEquals("喜欢慢慢走", UserService.normalizeBio(" 喜欢慢慢走 "));
        assertThrows(BusinessException.class, () -> UserService.normalizeBio("a".repeat(121)));
    }

    @Test
    void enumsOnlyAcceptSupportedValues() {
        assertEquals("ja-JP", UserService.requireLocale("ja-JP"));
        assertThrows(BusinessException.class, () -> UserService.requireLocale("fr-FR"));
        assertEquals("MI", UserService.requireDistanceUnit("MI"));
        assertThrows(BusinessException.class, () -> UserService.requireDistanceUnit("mile"));
        assertEquals("UNLISTED", UserService.requireVisibility("UNLISTED"));
        assertThrows(BusinessException.class, () -> UserService.requireVisibility("PUBLIC"));
        assertEquals(30, UserService.requireExpiryDays(30));
        assertThrows(BusinessException.class, () -> UserService.requireExpiryDays(3));
    }

    @Test
    void timezoneMustBeIanaName() {
        assertEquals("Asia/Tokyo", UserService.requireTimezone("Asia/Tokyo"));
        assertEquals("UTC", UserService.requireTimezone("UTC"));
        assertThrows(BusinessException.class, () -> UserService.requireTimezone("+09:00"));
        assertThrows(BusinessException.class, () -> UserService.requireTimezone("Tokyo"));
    }
}
