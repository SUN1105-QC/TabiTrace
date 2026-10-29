-- Durable cleanup survives project/trip/account deletion and application restarts.
-- No foreign keys: these ownership snapshots must outlive the deleted records.
CREATE TABLE video_output_deletions (
  project_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  trip_id BIGINT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(6) NOT NULL,
  last_error VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_video_output_deletion_due(next_attempt_at,project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
