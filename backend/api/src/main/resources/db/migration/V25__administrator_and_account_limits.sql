ALTER TABLE users
  ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'USER',
  ADD COLUMN user_level VARCHAR(40) NOT NULL DEFAULT '基础用户',
  ADD COLUMN trip_limit INT NOT NULL DEFAULT 20,
  ADD COLUMN trip_retention_months INT NOT NULL DEFAULT 1,
  ADD COLUMN can_share BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN can_video BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN custom_music_access VARCHAR(10) NOT NULL DEFAULT 'INHERIT',
  ADD COLUMN admin_slot TINYINT GENERATED ALWAYS AS (CASE WHEN role='ADMIN' THEN 1 ELSE NULL END) STORED,
  ADD UNIQUE KEY uk_single_administrator(admin_slot),
  ADD CONSTRAINT chk_user_role CHECK (role IN ('USER','ADMIN')),
  ADD CONSTRAINT chk_account_limits CHECK (trip_limit BETWEEN 1 AND 100000 AND trip_retention_months BETWEEN 1 AND 1200),
  ADD CONSTRAINT chk_custom_music_access CHECK (custom_music_access IN ('INHERIT','ALLOW','DENY'));

-- The designated administrator is provisioned once by Flyway. Only a BCrypt hash is stored.
INSERT INTO users(email,password_hash,nickname,status,role,locale,timezone,default_visibility,email_notifications,created_at,updated_at)
VALUES('sunqingchuan1105@gmail.com','$2a$12$3xtKyvEG3wX7BZJPQTbttOxZLe6tw71vfT6Kx7iMdxcQh3hW2FQku','管理员','ACTIVE','ADMIN','zh-CN','Asia/Tokyo','PRIVATE',FALSE,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE role='ADMIN',status='ACTIVE',password_hash=VALUES(password_hash),deletion_requested_at=NULL,deletion_scheduled_at=NULL,updated_at=UTC_TIMESTAMP(6);
-- Existing sessions must not inherit the newly assigned administrator role.
UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=(SELECT id FROM users WHERE role='ADMIN');

ALTER TABLE trips ADD COLUMN expires_at DATETIME(6) NULL;
UPDATE trips t JOIN users u ON u.id=t.user_id SET t.expires_at=DATE_ADD(t.created_at,INTERVAL u.trip_retention_months MONTH);
ALTER TABLE trips MODIFY expires_at DATETIME(6) NOT NULL, ADD INDEX idx_trip_expiry(expires_at,id);

CREATE TABLE support_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  subject VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  reply TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME(6) NOT NULL,
  replied_at DATETIME(6) NULL,
  CONSTRAINT fk_support_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_support_user(user_id,id),
  INDEX idx_support_status(status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE admin_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  details TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_admin_audit(created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
