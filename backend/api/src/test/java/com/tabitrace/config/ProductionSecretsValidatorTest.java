package com.tabitrace.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ProductionSecretsValidatorTest {
    @Test void rejectsMissingShortOrDevSecret(){
        assertThrows(IllegalStateException.class,()->ProductionSecretsValidator.validateJwtSecret(null));
        assertThrows(IllegalStateException.class,()->ProductionSecretsValidator.validateJwtSecret("too-short"));
        assertThrows(IllegalStateException.class,()->ProductionSecretsValidator.validateJwtSecret("tabitrace-dev-secret-change-me-32bytes-minimum"));
    }
    @Test void acceptsRandomSecret(){
        assertDoesNotThrow(()->ProductionSecretsValidator.validateJwtSecret("q8Vf3mZr1LxT9pWc2HsK7nYbE4uGdJ6aR0tXvB5eN8kQ"));
    }
}
