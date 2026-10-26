-- 账号会员（Membership）与「我的音乐」（自定义音乐上传）。
--
-- 会员与 Trip Pro 是两种权益：
-- - Trip Pro：针对某一趟旅行（trips.plan_type），负责 1080p、60 秒、去水印、更多照片、高级模板
-- - 会员：针对账号的持续权益（本表），目前负责上传 / 保存 / 跨旅行复用自定义音乐
-- 目前开通会员的方式是购买「买断 · 终身 Pro」（永不过期）；以后新增月度 / 年度订阅时只需写入带 expires_at 的记录。
CREATE TABLE memberships (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  -- LIFETIME（买断终身 Pro）/ SUBSCRIPTION（订阅，预留）/ GRANT（人工赠送）
  source VARCHAR(20) NOT NULL,
  -- ACTIVE / CANCELLED / REVOKED；是否到期由 expires_at 判断，不需要定时任务改状态
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  started_at DATETIME(6) NOT NULL,
  -- NULL = 永久有效
  expires_at DATETIME(6) NULL,
  payment_id BIGINT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_memberships_user(user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 已经买断终身 Pro 的账号补一条永久会员记录
INSERT INTO memberships(user_id, plan, source, status, started_at, expires_at, payment_id, created_at, updated_at)
SELECT u.id, 'MEMBER', 'LIFETIME', 'ACTIVE', u.lifetime_pro_at, NULL,
       (SELECT MAX(p.id) FROM payments p WHERE p.user_id = u.id AND p.product = 'LIFETIME' AND p.status = 'PAID'),
       UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM users u WHERE u.lifetime_pro_at IS NOT NULL;

-- 用户上传的音乐：与系统曲库 video_music 分开存放。只保存存储路径（随机生成），不保存本地绝对路径或公开地址。
CREATE TABLE user_music (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(60) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  -- user-music/{userId}/{uuid}.{mp3|m4a|wav}
  storage_key VARCHAR(255) NOT NULL,
  -- 解析后的真实类型：audio/mpeg / audio/mp4 / audio/wav
  mime_type VARCHAR(40) NOT NULL,
  file_size BIGINT NOT NULL,
  duration_seconds DECIMAL(8,2) NULL,
  -- UPLOADING / PROCESSING / READY / FAILED / DELETED
  status VARCHAR(20) NOT NULL,
  failure_code VARCHAR(40) NULL,
  copyright_confirmed BOOLEAN NOT NULL,
  copyright_confirmed_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6) NULL,
  -- 存储里的文件已经清理（删除后、排队中的视频生成完才清理）
  purged_at DATETIME(6) NULL,
  CONSTRAINT fk_user_music_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_music_storage_key(storage_key),
  INDEX idx_user_music_user(user_id, status, id),
  INDEX idx_user_music_cleanup(status, purged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Travel Story 记录音乐来源：SYSTEM（video_music.code）/ USER（user_music.id）/ NULL（无音乐）。
-- 不保存音乐地址；删除自己的音乐后草稿仍保留引用，界面提示「原音乐已被删除，请重新选择」。
ALTER TABLE video_projects
  ADD COLUMN music_source VARCHAR(10) NULL AFTER music_code,
  ADD COLUMN user_music_id BIGINT NULL AFTER music_source,
  ADD INDEX idx_video_projects_user_music(user_music_id, status);

UPDATE video_projects SET music_source = 'SYSTEM' WHERE music_code IS NOT NULL;
