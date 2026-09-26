-- 通用邮箱验证码：按 purpose 区分用途（REGISTER / RESET_PASSWORD / CHANGE_EMAIL）
-- 验证码与验证令牌都只保存哈希：code_hash = HMAC-SHA256(服务端密钥, purpose:email:code)，token_hash = SHA-256(令牌)
-- 同一张表同时是发送频率限制（按邮箱 / 按 IP）的依据，不需要额外的 Redis
CREATE TABLE email_verifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL,
  -- PENDING：已生成、邮件发送中；SENT：邮件已交给 SMTP；FAILED：发送失败（记录同时作废）
  send_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  expires_at DATETIME(6) NOT NULL,
  verified_at DATETIME(6) NULL,
  token_hash CHAR(64) NULL,
  token_expires_at DATETIME(6) NULL,
  consumed_at DATETIME(6) NULL,
  invalidated_at DATETIME(6) NULL,
  requester_ip_hash CHAR(64) NULL,
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uk_email_verifications_token (token_hash),
  INDEX idx_email_verifications_lookup (email, purpose, created_at),
  INDEX idx_email_verifications_ip (requester_ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
