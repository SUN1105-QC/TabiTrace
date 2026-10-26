-- 注销账号：申请后进入 7 天冷静期（status = DELETION_PENDING），期间重新登录可以撤销；
-- 到期由定时任务删除存储里的文件和账号（其余数据随外键级联删除）。
ALTER TABLE users
  ADD COLUMN deletion_requested_at DATETIME(6) NULL,
  ADD COLUMN deletion_scheduled_at DATETIME(6) NULL,
  ADD INDEX idx_users_deletion(status, deletion_scheduled_at);

-- 登录会话编号：同一台设备刷新令牌前后保持不变。访问令牌带上它，
-- 每次请求确认该会话仍有效，退出登录 / 移除设备 / 注销后旧的访问令牌立即失效。
ALTER TABLE refresh_tokens
  ADD COLUMN session_id CHAR(36) NULL AFTER jti,
  ADD INDEX idx_refresh_tokens_session(session_id, revoked_at);

UPDATE refresh_tokens SET session_id = jti WHERE session_id IS NULL;

-- 付款记录属于财务凭证：账号或旅行删除后仍保留（金额、币种、渠道单号、付款时间），只把关联置空。
ALTER TABLE payments
  DROP FOREIGN KEY fk_payments_user,
  DROP FOREIGN KEY fk_payments_trip;
ALTER TABLE payments
  MODIFY user_id BIGINT NULL,
  ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_payments_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;

-- 同一笔渠道付款（Stripe Checkout Session）只能对应一条记录，并发的重复 Webhook 不会产生第二条
ALTER TABLE payments
  DROP INDEX idx_payments_provider,
  ADD UNIQUE KEY uk_payments_provider_payment(provider_payment_id);
