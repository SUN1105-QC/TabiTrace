package com.tabitrace.security;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {
    @Test void createsAndParsesAccessToken(){JwtService s=new JwtService("0123456789012345678901234567890123456789",15,30);String token=s.createAccessToken(7L,"demo@example.com");var c=s.parse(token);assertEquals("7",c.getSubject());assertEquals("ACCESS",c.get("type",String.class));assertEquals("demo@example.com",c.get("email",String.class));}
}
