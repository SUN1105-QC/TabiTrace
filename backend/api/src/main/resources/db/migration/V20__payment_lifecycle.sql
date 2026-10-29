-- Durable Checkout orders, reconciliation, and payment-scoped entitlement recovery.
ALTER TABLE payments
  ADD COLUMN order_user_id BIGINT NULL,
  ADD COLUMN order_trip_id BIGINT NULL,
  ADD COLUMN checkout_key VARCHAR(100) NULL,
  ADD COLUMN checkout_url TEXT NULL,
  ADD COLUMN checkout_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN payment_intent_id VARCHAR(255) NULL,
  ADD COLUMN charge_id VARCHAR(255) NULL,
  ADD COLUMN refunded_amount INT NOT NULL DEFAULT 0,
  ADD COLUMN dispute_id VARCHAR(255) NULL,
  ADD COLUMN dispute_status VARCHAR(40) NULL,
  ADD COLUMN expires_at DATETIME(6) NULL,
  ADD COLUMN last_synced_at DATETIME(6) NULL,
  ADD COLUMN last_checked_at DATETIME(6) NULL,
  ADD UNIQUE KEY uk_payments_checkout_key(checkout_key),
  ADD UNIQUE KEY uk_payments_intent(payment_intent_id),
  ADD INDEX idx_payments_reconcile(provider,status,last_checked_at,id);
UPDATE payments SET order_user_id=user_id,order_trip_id=trip_id;
-- Legacy pending rows are not merged or locally expired: only Stripe may confirm their outcome.
-- New checkout creation also checks all legacy pending rows under the account lock.

CREATE TABLE payment_events (
  event_id VARCHAR(255) PRIMARY KEY,
  payment_id BIGINT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_payment_events_payment FOREIGN KEY(payment_id) REFERENCES payments(id),
  INDEX idx_payment_events_payment(payment_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Preserve pre-existing non-payment grants when recomputing entitlements after refunds.
ALTER TABLE users ADD COLUMN lifetime_pro_grant BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN pro_grant BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users u SET lifetime_pro_grant=TRUE
 WHERE lifetime_pro_at IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM payments p WHERE p.user_id=u.id AND p.product='LIFETIME' AND p.status='PAID');
-- Legacy lifetime upgrades have no per-trip provenance. Preserve ambiguous old Pro trips
-- instead of accidentally revoking an earlier manual grant; review these manually on refund.
UPDATE trips t SET t.pro_grant=TRUE
 WHERE t.plan_type='PRO' AND NOT EXISTS
 (SELECT 1 FROM payments p WHERE p.trip_id=t.id AND p.product='TRIP_PRO' AND p.status='PAID');
