-- 本地开发（无 Docker）初始化：创建 tabitrace 业务库与应用账号，与 docker-compose.yml 保持一致。
-- 用法（以管理员账号执行，密码在提示时输入）：
--   mysql -u root -p -e "source backend/scripts/mysql-init-local.sql"
-- 表结构与东京种子数据由 API 启动时的 Flyway（V1、V2）创建，请勿在此手工建表，
-- 否则 Flyway 会因 schema 非空且缺少 flyway_schema_history 而拒绝迁移。

CREATE DATABASE IF NOT EXISTS tabitrace
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- 与 application.yml / .env.example 的本地默认值一致，仅限本机连接；生产环境请使用独立强密码
-- CREATE USER IF NOT EXISTS 不会修改已存在账号的密码，因此再用 ALTER USER 统一重置，脚本可重复执行
CREATE USER IF NOT EXISTS 'tabitrace_app'@'localhost' IDENTIFIED BY 'tabitrace_dev';
ALTER USER 'tabitrace_app'@'localhost' IDENTIFIED BY 'tabitrace_dev';
GRANT ALL PRIVILEGES ON tabitrace.* TO 'tabitrace_app'@'localhost';

SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'tabitrace';
SELECT user, host, plugin FROM mysql.user WHERE user = 'tabitrace_app';
