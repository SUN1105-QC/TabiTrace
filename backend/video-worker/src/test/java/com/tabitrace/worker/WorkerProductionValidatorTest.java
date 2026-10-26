package com.tabitrace.worker;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WorkerProductionValidatorTest {
    @Test void requiresObjectStorageInProduction() {
        Map<String, String> m = new HashMap<>();
        m.put("worker.storage.mode", "mock");
        m.put("spring.datasource.password", "tabitrace_dev");
        String all = String.join("\n", WorkerProductionValidator.validate(m::get));
        for (String name : new String[]{"STORAGE_MODE", "R2_ENDPOINT", "R2_BUCKET", "R2_PUBLIC_BASE_URL", "DB_PASSWORD"}) assertTrue(all.contains(name), name);

        m.put("worker.storage.mode", "r2");
        m.put("worker.storage.r2.endpoint", "https://acc.r2.cloudflarestorage.com");
        m.put("worker.storage.r2.access-key", "ak");
        m.put("worker.storage.r2.secret-key", "sk");
        m.put("worker.storage.r2.bucket", "media");
        m.put("worker.storage.r2.public-base-url", "https://media.example.com");
        m.put("spring.datasource.password", "strong");
        assertTrue(WorkerProductionValidator.validate(m::get).isEmpty());
    }
}
