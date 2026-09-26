# TabiTrace
打卡旅迹

旅迹 TabiTrace：用地图、时间轴、照片和故事，把旅行从「去过」变成可以长期收藏、回看和分享的个人作品。

## 目录结构

```
.
├── frontend/            Next.js 16 前端（App Router + React 19 + Tailwind）
├── backend/
│   ├── api/             Spring Boot 4 API（Java 21 + MyBatis + Flyway + MySQL）
│   └── video-worker/    视频渲染 Worker（轮询 QUEUED 任务，调用 FFmpeg 生成 MP4）
├── docs/                产品 / 数据库 / 审计文档
├── AI开发执行指令/       各阶段开发指令
└── 启动TabiTrace前后端.bat
```

## 本地启动

**最省事**：双击根目录的 `启动TabiTrace前后端.bat`，会分别打开后端、视频渲染服务、前端三个窗口（已在运行的不会重复启动）。找到 FFmpeg 时自动启用真实视频渲染；找不到时后端改用模拟渲染器，视频只走状态流程、不能播放。数据库需要先按下面第 1 步初始化。

手动启动：

1. **数据库**：MySQL 8，先执行 `backend/scripts/mysql-init-local.sql` 创建库和 `tabitrace_app` 账号；表结构由 Flyway 在 API 启动时自动建好。
2. **后端 API**：`mvn -f backend/pom.xml -pl api spring-boot:run` → http://localhost:8080/api/v1
3. **前端**：`cd frontend && npm install && npm run dev` → http://localhost:3000
4. **视频渲染（可选）**：需要本机安装 FFmpeg，详见 [backend/README.md](backend/README.md) 的「启动视频 Worker」。

配置项全部走环境变量，参考 [backend/.env.example](backend/.env.example)。仓库里出现的 `tabitrace_dev`、`*-change-me-*` 等都是**仅限本地开发的默认值**，生产环境必须替换（`prod` profile 会拒绝弱 JWT 密钥）。

## 不在仓库里的东西

`.gitignore` 排除了：依赖与构建产物、`.tools/`（本地 FFmpeg 二进制）、日志、`backend/.tabitrace/`（本地上传的照片）、`frontend/public/generated-videos/`（渲染出的视频）以及所有 `.env` 文件。
