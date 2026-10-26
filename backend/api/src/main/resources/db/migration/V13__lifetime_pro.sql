-- 计费调整：单次旅行 Trip Pro ¥1.1（金额在代码常量里），新增「买断 · 终身 Pro」¥1000。
-- 终身 Pro 是账号级权益：付款成功后记下时间，账号下现有与以后新建的旅行都是 PRO。
ALTER TABLE users
  ADD COLUMN lifetime_pro_at DATETIME(6) NULL;

-- 付款记录区分商品：TRIP_PRO（关联某段旅行）/ LIFETIME（账号级，不关联旅行）
ALTER TABLE payments
  MODIFY COLUMN trip_id BIGINT NULL,
  ADD COLUMN product VARCHAR(20) NOT NULL DEFAULT 'TRIP_PRO' AFTER trip_id,
  ADD INDEX idx_payments_user_product(user_id, product, id);
