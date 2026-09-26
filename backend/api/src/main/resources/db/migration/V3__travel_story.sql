-- Travel Story：视频项目扩展字段 + 模板 / 音乐目录
-- 只做加法，不改动已有列的含义；旧的 show_text / show_map / show_achievements 继续保留并与 settings_json 同步。

ALTER TABLE video_projects
  ADD COLUMN name VARCHAR(200) NULL AFTER trip_id,
  ADD COLUMN quality VARCHAR(10) NOT NULL DEFAULT '720p' AFTER duration,
  ADD COLUMN cover_photo_id BIGINT NULL AFTER quality,
  ADD COLUMN settings_json JSON NULL AFTER show_achievements,
  ADD COLUMN storyboard_json JSON NULL AFTER settings_json,
  ADD COLUMN render_stage VARCHAR(30) NULL AFTER progress,
  ADD COLUMN renderer VARCHAR(20) NULL AFTER render_stage,
  ADD COLUMN error_code VARCHAR(50) NULL AFTER output_url;

-- 已有项目：按旅行套餐回填清晰度
UPDATE video_projects v JOIN trips t ON t.id = v.trip_id
   SET v.quality = CASE WHEN t.plan_type = 'PRO' THEN '1080p' ELSE '720p' END;

-- 已有项目：区分模拟渲染器与真实 FFmpeg 的产物，前端据此决定是否展示播放器
UPDATE video_projects SET renderer = 'MOCK'
 WHERE output_url LIKE 'https://example.invalid/%';
UPDATE video_projects SET renderer = 'FFMPEG'
 WHERE status = 'COMPLETED' AND renderer IS NULL AND output_url IS NOT NULL;

CREATE TABLE video_templates (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  english_name VARCHAR(100) NOT NULL,
  description VARCHAR(300) NOT NULL,
  suitable_for VARCHAR(300) NOT NULL,
  pace VARCHAR(20) NOT NULL,
  transition VARCHAR(30) NOT NULL,
  transition_seconds DECIMAL(4,2) NOT NULL,
  plan VARCHAR(20) NOT NULL,
  recommended_music VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE video_music (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL,
  mood VARCHAR(200) NOT NULL,
  duration_seconds DECIMAL(6,2) NULL,
  plan VARCHAR(20) NOT NULL,
  recommended_template VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- pace：SLOW / MEDIUM / FAST，决定单张照片停留时长
-- transition：ffmpeg xfade 转场名称
INSERT INTO video_templates(code,name,english_name,description,suitable_for,pace,transition,transition_seconds,plan,recommended_music,sort_order,enabled) VALUES
('JOURNAL','旅行日记','Journal','温暖的照片叙事，带日期、地点和旅行文字，节奏舒缓。','普通旅行 · 家庭旅行 · 长途旅行','SLOW','fade',0.60,'FREE','WARM_JOURNEY',1,TRUE),
('MINIMAL','极简杂志','Minimal','大图留白、少量文字、慢转场，突出照片本身的质感。','摄影旅行 · 情侣旅行 · 精选照片','SLOW','fade',0.90,'PRO','SLOW_MORNING',2,TRUE),
('CITY','城市节奏','City','快节奏剪辑、城市大字标题、路线地图和快速转场。','东京 · 大阪 · 首尔 · 上海 · 纽约等城市旅行','FAST','slideleft',0.30,'PRO','TOKYO_NIGHT',3,TRUE);

-- category：NONE / WARM / CITY / FRESH / CINEMATIC / CHILL
-- duration_seconds：当前 public/music 下占位音轨的实际循环长度，换成正式音乐后请同步更新
INSERT INTO video_music(code,name,category,mood,duration_seconds,plan,recommended_template,sort_order,enabled) VALUES
('NONE','无音乐','NONE','只保留画面，适合后期自己配音',NULL,'FREE',NULL,0,TRUE),
('WARM_JOURNEY','Warm Journey','WARM','温暖轻快 · 推荐旅行日记',8.00,'FREE','JOURNAL',1,TRUE),
('SLOW_MORNING','Slow Morning','FRESH','清新轻柔 · 推荐极简杂志',12.00,'FREE','MINIMAL',2,TRUE),
('CITY_WALK','City Walk','CHILL','轻松随性 · 适合街拍与散步',4.80,'FREE','JOURNAL',3,TRUE),
('TOKYO_NIGHT','Tokyo Night','CITY','城市电子 · 推荐城市节奏',9.60,'PRO','CITY',4,TRUE),
('MEMORIES','Memories','CINEMATIC','电影感 · 适合旅行总结片尾',12.80,'PRO','MINIMAL',5,TRUE);
