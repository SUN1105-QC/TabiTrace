-- 头像小图：导航栏、侧栏等只显示 32–64px，原来每个页面都要下载 512×512 的头像（约 70KB）。
-- 上传头像时前端额外生成 160×160 的小图（够 64px 的 2 倍屏、46px 的 3 倍屏），存在同一目录下。
-- 旧头像没有小图，前端回退到 avatar_url。
ALTER TABLE users ADD COLUMN avatar_small_url VARCHAR(500) NULL AFTER avatar_url;
