-- 设置中心：个人简介、距离单位、分享隐私、站内通知分类；登录会话记录设备信息
ALTER TABLE users
  ADD COLUMN bio VARCHAR(120) NULL AFTER avatar_url,
  ADD COLUMN distance_unit VARCHAR(10) NOT NULL DEFAULT 'KM' AFTER timezone,
  ADD COLUMN share_exact_location BOOLEAN NOT NULL DEFAULT FALSE AFTER default_visibility,
  ADD COLUMN share_link_expiry_days INT NOT NULL DEFAULT 0 AFTER share_exact_location,
  ADD COLUMN notify_trip_reminder BOOLEAN NOT NULL DEFAULT TRUE AFTER email_notifications,
  ADD COLUMN notify_story BOOLEAN NOT NULL DEFAULT TRUE AFTER notify_trip_reminder,
  ADD COLUMN notify_achievement BOOLEAN NOT NULL DEFAULT TRUE AFTER notify_story,
  ADD COLUMN notify_share BOOLEAN NOT NULL DEFAULT TRUE AFTER notify_achievement;

-- 每个有效 refresh token 对应一台已登录设备；刷新时沿用首次登录时间与设备信息
ALTER TABLE refresh_tokens
  ADD COLUMN user_agent VARCHAR(255) NULL AFTER jti,
  ADD COLUMN session_started_at DATETIME(6) NULL AFTER user_agent;
