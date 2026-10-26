-- 快速打卡自动记录的信息：打卡时所在的时区、定位精度，以及打卡时刻的天气快照（能拿到的部分）。
-- 全部可空：定位 / 天气失败不影响保存，也不回填任何猜测值。
ALTER TABLE checkins
  ADD COLUMN timezone VARCHAR(64) NULL AFTER checkin_time,
  ADD COLUMN location_accuracy_m INT NULL AFTER longitude,
  ADD COLUMN weather_code SMALLINT NULL,
  ADD COLUMN weather_text VARCHAR(40) NULL,
  ADD COLUMN temperature_c DECIMAL(4,1) NULL,
  ADD COLUMN weather_observed_at DATETIME(6) NULL,
  ADD COLUMN weather_source VARCHAR(40) NULL;
