package com.tabitrace.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Profile("prod")
public class ProductionSecretsValidator {
    public ProductionSecretsValidator(@Value("${app.jwt.secret}") String jwtSecret) {
        validateJwtSecret(jwtSecret);
    }

    static void validateJwtSecret(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32 || secret.contains("change-me"))
            throw new IllegalStateException("prod 环境必须通过 JWT_SECRET 配置至少 32 字节的随机密钥，不能使用开发默认值");
    }
}
