-- 管理端功能只追加新表；既有用户的等级、配额、旅程和权限不做回填。
ALTER TABLE users ADD COLUMN deletion_requested_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN deletion_previous_status VARCHAR(20) NULL;

CREATE TABLE admin_registration_defaults (
  id INT PRIMARY KEY,
  user_level VARCHAR(40) NOT NULL,
  trip_limit INT NOT NULL,
  trip_retention_months INT NOT NULL,
  can_share BOOLEAN NOT NULL,
  can_video BOOLEAN NOT NULL,
  custom_music_access VARCHAR(10) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT chk_registration_limits CHECK (trip_limit BETWEEN 1 AND 100000 AND trip_retention_months BETWEEN 1 AND 1200),
  CONSTRAINT chk_registration_music CHECK (custom_music_access IN ('INHERIT','ALLOW','DENY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO admin_registration_defaults VALUES(1,'基础用户',20,1,TRUE,TRUE,'INHERIT',UTC_TIMESTAMP(6));

-- 邀请只引导公开注册；收件人仍须通过原有邮箱验证码验证，管理员不会代设密码。
CREATE TABLE admin_user_invitations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_by BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  pending_email VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN status='PENDING' THEN email ELSE NULL END) STORED,
  UNIQUE KEY uk_pending_invitation(pending_email),
  INDEX idx_invitation_status(status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE admin_maintenance_jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  requested_by BIGINT NOT NULL,
  result VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL,
  started_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status IN ('QUEUED','RUNNING') THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY uk_active_maintenance(active_slot),
  INDEX idx_maintenance_queue(status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
