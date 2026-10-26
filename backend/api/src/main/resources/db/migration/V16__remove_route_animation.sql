-- Travel Story 不再包含旅行路线动画（地图路线段落）。
-- 1. video_projects.show_map：旧版「是否显示地图路线」开关，已无用途
-- 2. City 模板介绍去掉「路线地图」
-- 已经生成的视频不受影响（成片已在存储里）；旧草稿里保存的路线设置会被忽略，重新生成时不再出现地图段落。
ALTER TABLE video_projects DROP COLUMN show_map;

UPDATE video_templates SET description = '快节奏剪辑、城市大字标题和快速转场。' WHERE code = 'CITY';
