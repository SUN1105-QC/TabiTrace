-- Operational usage, not a new pricing model. Limits default to monitoring only.
CREATE TABLE cost_control_locks (
  name VARCHAR(40) PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO cost_control_locks(name) VALUES('video-render');

CREATE TABLE render_usage_daily (
  scope VARCHAR(64) NOT NULL,
  usage_date DATE NOT NULL,
  user_id BIGINT NULL,
  render_count BIGINT NOT NULL DEFAULT 0,
  output_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(scope,usage_date),
  CONSTRAINT fk_render_usage_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE cost_alerts (
  scope VARCHAR(64) NOT NULL,
  alert_date DATE NOT NULL,
  kind VARCHAR(40) NOT NULL,
  observed_value BIGINT NOT NULL,
  threshold_value BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY(scope,alert_date,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE video_projects ADD COLUMN output_bytes BIGINT NULL;
-- Historical render requests cannot be reconstructed reliably after project deletion.
-- Counters start with this release; existing output sizes remain explicitly unmeasured.
