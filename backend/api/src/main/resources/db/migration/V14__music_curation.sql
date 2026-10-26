-- Travel Story 音乐模块重构：精选「旅行氛围歌单」
-- 1. 曲目字段补充：能量等级（推荐用）、是否允许改编（授权字段）、推荐模板改为可多选
-- 2. 「无音乐」不再是一条假的音乐记录：video_projects.music_code = NULL 表示无音乐
-- 3. 分类收敛为 5 个旅行氛围：WARM 温暖旅程 / CITY_NIGHT 城市夜色 / MORNING 清晨治愈 / LOFI Lo-fi / CINEMATIC 电影感
--    已核验（APPROVED）的 33 首中精选 19 首启用，其余只停用（enabled = FALSE），不删除，历史视频与授权记录保留
-- 4. 记录 4 首已核验 CC0 授权、但音频尚未导入的候选曲目：只写元数据，保持 REVIEW_REQUIRED + 停用，不伪装可播放
-- 5. 视频生成告警：音乐读取失败时 Worker 改用无音乐继续生成，并写 render_warning = 'MUSIC_FALLBACK'

ALTER TABLE video_music
  RENAME COLUMN recommended_template TO recommended_templates;
ALTER TABLE video_music
  MODIFY COLUMN recommended_templates VARCHAR(80) NULL COMMENT '推荐模板，逗号分隔（JOURNAL,MINIMAL,CITY）',
  ADD COLUMN energy VARCHAR(10) NULL COMMENT 'LOW / MEDIUM / HIGH，规则推荐用' AFTER bpm,
  ADD COLUMN derivatives_allowed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '授权是否允许剪辑 / 改编（成片会截取、淡入淡出、循环）' AFTER commercial_use;

ALTER TABLE video_projects
  ADD COLUMN render_warning VARCHAR(40) NULL COMMENT '生成成功但有降级，例如 MUSIC_FALLBACK（音乐不可用，已用无音乐生成）' AFTER error_message;

-- 无音乐：去掉假的 NONE 记录（music_code 改为可空，NULL 即无音乐）
ALTER TABLE video_projects MODIFY COLUMN music_code VARCHAR(50) NULL COMMENT '背景音乐代码；NULL = 无音乐';
UPDATE video_projects SET music_code = NULL WHERE music_code = 'NONE';
DELETE FROM video_music WHERE code = 'NONE';

-- CC BY 4.0 允许改编（需署名）；CC0 放弃全部权利
UPDATE video_music SET derivatives_allowed = TRUE WHERE license IN ('CC BY 4.0', 'CC0 1.0');

-- 先全部停用，再逐首启用精选曲目（只启用授权已核验、音频已导入自己存储的曲目）
UPDATE video_music SET enabled = FALSE, recommended_templates = NULL;

-- 温暖旅程（Journal）：木吉他 / 曼陀林 / 轻钢琴
UPDATE video_music SET category='WARM', mood='warm,happy,acoustic', energy='MEDIUM', plan='FREE', recommended_templates='JOURNAL', sort_order=10, enabled=TRUE WHERE code='SB_WANDERLUST' AND status='APPROVED';
UPDATE video_music SET category='WARM', mood='warm,happy,acoustic', energy='MEDIUM', plan='FREE', recommended_templates='JOURNAL', sort_order=11, enabled=TRUE WHERE code='SB_SIMPLICITY' AND status='APPROVED';
UPDATE video_music SET category='WARM', mood='happy,warm,piano', energy='HIGH', plan='PRO', recommended_templates='JOURNAL', sort_order=12, enabled=TRUE WHERE code='SB_FELICITY' AND status='APPROVED';
UPDATE video_music SET category='WARM', mood='warm,nostalgic,piano', energy='LOW', plan='PRO', recommended_templates='JOURNAL,MINIMAL', sort_order=13, enabled=TRUE WHERE code='SB_HOME_WAS_YOU' AND status='APPROVED';

-- 城市夜色（City）：电子 / 合成器 / 夜晚
UPDATE video_music SET category='CITY_NIGHT', mood='urban,electronic,happy', energy='MEDIUM', plan='FREE', recommended_templates='CITY', sort_order=20, enabled=TRUE WHERE code='SB_ORIGAMI' AND status='APPROVED';
UPDATE video_music SET category='CITY_NIGHT', mood='urban,night,electronic', energy='MEDIUM', plan='PRO', recommended_templates='CITY', sort_order=21, enabled=TRUE WHERE code='KM_CHILL_WAVE' AND status='APPROVED';
UPDATE video_music SET category='CITY_NIGHT', mood='urban,electronic', energy='HIGH', plan='PRO', recommended_templates='CITY', sort_order=22, enabled=TRUE WHERE code='KM_ETERNITY' AND status='APPROVED';
UPDATE video_music SET category='CITY_NIGHT', mood='night,calm,electronic', energy='LOW', plan='PRO', recommended_templates='CITY,MINIMAL', sort_order=23, enabled=TRUE WHERE code='SB_PETRICHOR' AND status='APPROVED';

-- 清晨治愈（Minimal）：钢琴 / 原声 / 柔和
UPDATE video_music SET category='MORNING', mood='morning,calm,acoustic', energy='LOW', plan='FREE', recommended_templates='MINIMAL', sort_order=30, enabled=TRUE WHERE code='KM_MORNING' AND status='APPROVED';
UPDATE video_music SET category='MORNING', mood='morning,warm,acoustic', energy='LOW', plan='FREE', recommended_templates='MINIMAL,JOURNAL', sort_order=31, enabled=TRUE WHERE code='SB_GLOW' AND status='APPROVED';
UPDATE video_music SET category='MORNING', mood='morning,calm,piano', energy='LOW', plan='PRO', recommended_templates='MINIMAL', sort_order=32, enabled=TRUE WHERE code='KM_WATER_LILY' AND status='APPROVED';
UPDATE video_music SET category='MORNING', mood='calm,romantic,piano', energy='LOW', plan='PRO', recommended_templates='MINIMAL', sort_order=33, enabled=TRUE WHERE code='SB_MOONLIGHT' AND status='APPROVED';

-- Lo-fi（日常 / 街拍 / 城市漫步）
UPDATE video_music SET category='LOFI', mood='lofi,chill,night', energy='MEDIUM', plan='FREE', recommended_templates='JOURNAL,CITY', sort_order=40, enabled=TRUE WHERE code='KM_LATE_NIGHT_RADIO' AND status='APPROVED';
UPDATE video_music SET category='LOFI', mood='lofi,chill,urban', energy='MEDIUM', plan='FREE', recommended_templates='CITY,JOURNAL', sort_order=41, enabled=TRUE WHERE code='KM_COOL_VIBES' AND status='APPROVED';
UPDATE video_music SET category='LOFI', mood='lofi,chill,warm', energy='LOW', plan='PRO', recommended_templates='JOURNAL', sort_order=42, enabled=TRUE WHERE code='KM_SUMMER_DAY' AND status='APPROVED';

-- 电影感（风景 / 公路 / 大片）
UPDATE video_music SET category='CINEMATIC', mood='cinematic,nostalgic,piano', energy='MEDIUM', plan='FREE', recommended_templates='MINIMAL,JOURNAL', sort_order=50, enabled=TRUE WHERE code='SB_WILDFLOWERS' AND status='APPROVED';
UPDATE video_music SET category='CINEMATIC', mood='cinematic,happy', energy='HIGH', plan='PRO', recommended_templates='JOURNAL,MINIMAL', sort_order=51, enabled=TRUE WHERE code='SB_CLEAR_SKIES' AND status='APPROVED';
UPDATE video_music SET category='CINEMATIC', mood='cinematic,calm', energy='MEDIUM', plan='PRO', recommended_templates='MINIMAL', sort_order=52, enabled=TRUE WHERE code='SB_CHASING_DAYLIGHT' AND status='APPROVED';
UPDATE video_music SET category='CINEMATIC', mood='cinematic,warm,nostalgic', energy='MEDIUM', plan='PRO', recommended_templates='JOURNAL,CITY', sort_order=53, enabled=TRUE WHERE code='SB_ECHOES_OF_HOME' AND status='APPROVED';

-- 未精选的已核验曲目：保留授权记录，只停用；分类也归入新分类，日后启用不必再改分类
UPDATE video_music SET category='WARM', energy='LOW', sort_order=110 WHERE code IN ('KM_PEPPERS_THEME','KM_AUTUMN_DAY','KM_WINDSWEPT');
UPDATE video_music SET category='CITY_NIGHT', energy='LOW', sort_order=120 WHERE code IN ('KM_DREAM_CULTURE','KM_GEORGE_STREET_SHUFFLE');
UPDATE video_music SET category='MORNING', energy='LOW', sort_order=130 WHERE code IN ('KM_DREAMER','SB_SOLACE','SB_CICADAS','KM_SENBAZURU','KM_EVENING');
UPDATE video_music SET category='CINEMATIC', energy='LOW', sort_order=150 WHERE code IN ('SB_AMBERLIGHT','SB_WITH_THESE_HANDS','SB_THE_LONG_WAY_HOME','SB_GOLDEN_HOUR');
-- Pixabay 候选：授权未确认（内容许可不等于允许作为 SaaS 内置曲库），保持 REVIEW_REQUIRED + 停用
UPDATE video_music SET category='WARM', sort_order=900 WHERE code IN ('PX_SCENERY_OF_MEMORIES','PX_SUNSET_DAWN','PX_WINTER_SUNSET','PX_THIS_SUNSET','PX_MORNING_GARDEN');
UPDATE video_music SET category='LOFI', sort_order=900 WHERE code = 'PX_TOKYO_CAFE';
UPDATE video_music SET category='CINEMATIC', sort_order=900 WHERE code = 'PX_AMBIENT_CINEMATIC';

-- CC0 候选（HoliznaCC0 · Free Music Archive「Public Domain Lofi」）：
-- 授权已在曲目页核对为 CC0 1.0 Universal（2026-10-07），但音频尚未下载、试听与导入存储，
-- 所以只登记元数据：REVIEW_REQUIRED + 停用 + 无存储路径。导入并试听通过后再改为 APPROVED / 启用。
INSERT INTO video_music(code,name,category,mood,duration_seconds,plan,recommended_templates,sort_order,enabled,
  artist,source,source_url,download_url,license,license_url,license_notes,attribution_required,attribution_text,commercial_use,derivatives_allowed,export_allowed,status,
  energy,instruments,essential,license_checked_at) VALUES
('HZ_TOKYO_SUNSET','Tokyo Sunset','LOFI','lofi,calm,urban',138,'FREE','CITY,JOURNAL',60,FALSE,'HoliznaCC0','Free Music Archive','https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tokyo-sunset-lofi-peaceful-soft/',NULL,'CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','FMA 曲目页标注 "CC0 1.0 Universal License"（专辑 Public Domain Lofi 同样标注 CC0）。注意：作者在 Bandcamp 上的部分作品标注为 CC BY 4.0，导入前需确认导入的文件来自 FMA 的 CC0 版本。待下载、试听、导入存储。',FALSE,NULL,TRUE,TRUE,TRUE,'REVIEW_REQUIRED','LOW','lofi beats,keys',FALSE,'2026-10-07'),
('HZ_WALKING_AWAY','Walking Away','LOFI','lofi,warm,happy',156,'FREE','JOURNAL,CITY',61,FALSE,'HoliznaCC0','Free Music Archive','https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/walking-away-lofi-peaceful-motivating/',NULL,'CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','FMA 曲目页标注 "CC0 1.0 Universal License"。待下载、试听、导入存储。',FALSE,NULL,TRUE,TRUE,TRUE,'REVIEW_REQUIRED','MEDIUM','lofi beats,keys',FALSE,'2026-10-07'),
('HZ_OCEAN_BREEZE','Ocean Breeze','LOFI','lofi,calm,acoustic',197,'PRO','JOURNAL,MINIMAL',62,FALSE,'HoliznaCC0','Free Music Archive','https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ocean-breeze-lofi-ukulele-peaceful-mp3/',NULL,'CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','FMA 曲目页标注 "CC0 1.0 Universal License"。尤克里里 Lo-fi，适合海边 / 海岛。待下载、试听、导入存储。',FALSE,NULL,TRUE,TRUE,TRUE,'REVIEW_REQUIRED','LOW','ukulele,lofi beats',FALSE,'2026-10-07'),
('HZ_ONE_NIGHT_IN_FRANCE','One Night In France','LOFI','lofi,night,nostalgic',194,'PRO','CITY',63,FALSE,'HoliznaCC0','Free Music Archive','https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-night-in-france-lofi-nostalgic-chill/',NULL,'CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/','FMA 曲目页标注 "CC0 1.0 Universal License"。待下载、试听、导入存储。',FALSE,NULL,TRUE,TRUE,TRUE,'REVIEW_REQUIRED','LOW','lofi beats,keys',FALSE,'2026-10-07');
