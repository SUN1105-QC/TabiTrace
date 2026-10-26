-- 登录失败记录：用于登录频率限制（按邮箱 / 按 IP），防止暴力猜密码
-- 只记录失败；登录成功或重置密码后清除该邮箱的记录；IP 只保存 HMAC 哈希
CREATE TABLE login_failures (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  ip_hash CHAR(64) NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_login_failures_email (email, created_at),
  INDEX idx_login_failures_ip (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
