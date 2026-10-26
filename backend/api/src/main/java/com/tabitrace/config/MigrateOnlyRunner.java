package com.tabitrace.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

/**
 * 只执行数据库迁移然后退出（db:migrate）：
 *   java -jar tabitrace-api.jar --server.port=0 --app.migrate-only=true
 * Flyway 在应用启动时已经完成迁移，这里打印当前版本后以退出码 0 结束；迁移失败时应用启动失败、退出码非 0。
 * 正常部署不需要单独执行（API 启动时自动迁移），用于空库初始化、升级前的预演与 CI。
 */
@Component
@ConditionalOnProperty(name = "app.migrate-only", havingValue = "true")
public class MigrateOnlyRunner implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(MigrateOnlyRunner.class);
    private final Flyway flyway;
    private final ApplicationContext context;

    public MigrateOnlyRunner(Flyway flyway, ApplicationContext context) {
        this.flyway = flyway;
        this.context = context;
    }

    @Override
    public void run(String... args) {
        var current = flyway.info().current();
        log.info("数据库迁移完成：当前版本 V{}（{}），待执行 {} 个", current == null ? "-" : current.getVersion(), current == null ? "空库" : current.getDescription(), flyway.info().pending().length);
        System.exit(SpringApplication.exit(context, () -> 0));
    }
}
