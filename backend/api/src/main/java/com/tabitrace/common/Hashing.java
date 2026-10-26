package com.tabitrace.common;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

/** 认证相关的哈希工具：带服务端密钥的 HMAC（验证码、IP）与普通 SHA-256（高熵令牌） */
public final class Hashing {
    private Hashing() {}

    public static String hmacSha256Hex(byte[] key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) { throw new IllegalStateException(ex); }
    }

    public static String sha256Hex(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (GeneralSecurityException ex) { throw new IllegalStateException(ex); }
    }

    /** 两个十六进制摘要的常量时间比较 */
    public static boolean constantTimeEquals(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }
}
