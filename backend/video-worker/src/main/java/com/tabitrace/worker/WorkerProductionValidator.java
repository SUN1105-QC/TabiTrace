package com.tabitrace.worker;

import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** prod 启动自检：成片存储与数据库配置不完整时直接启动失败，只列出变量名，不输出任何值 */
@Component
@Profile("prod")
public class WorkerProductionValidator {
    public WorkerProductionValidator(Environment env) {
        List<String> problems = validate(env::getProperty);
        if (!problems.isEmpty()) throw new IllegalStateException("Worker 生产配置不完整，拒绝启动：\n - " + String.join("\n - ", problems));
    }

    static List<String> validate(Function<String, String> p) {
        List<String> problems = new ArrayList<>();
        if (!"r2".equalsIgnoreCase(p.apply("worker.storage.mode"))) problems.add("STORAGE_MODE：生产环境成片必须上传到对象存储（r2）");
        for (String[] k : new String[][]{{"worker.storage.r2.endpoint", "R2_ENDPOINT"}, {"worker.storage.r2.access-key", "R2_ACCESS_KEY"},
                {"worker.storage.r2.secret-key", "R2_SECRET_KEY"}, {"worker.storage.r2.bucket", "R2_BUCKET"}})
            if (blank(p.apply(k[0]))) problems.add(k[1] + "：未配置");
        String base = p.apply("worker.storage.r2.public-base-url");
        if (blank(base) || !base.startsWith("https://")) problems.add("R2_PUBLIC_BASE_URL：必须是存储桶的 https 公开访问地址");
        if ("tabitrace_dev".equals(p.apply("spring.datasource.password"))) problems.add("DB_PASSWORD：不能使用开发默认密码");
        return problems;
    }

    private static boolean blank(String v) { return v == null || v.isBlank(); }
}
