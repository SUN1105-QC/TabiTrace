# TabiTrace
打卡旅迹

SUNOWS / AWS Lightsail 部署：见 [deploy/lightsail/README.md](deploy/lightsail/README.md)。目标域名 `https://tabi.sunows.com`，独立 Compose 管理 web、api、视频 worker 与 MySQL 8.4。

旅迹 TabiTrace：用地图、时间轴、照片和故事，把旅行从「去过」变成可以长期收藏、回看和分享的个人作品。

**项目设计文档从 [docs/README.md](docs/README.md) 开始**：项目说明、需求、业务规则、架构、数据库、API、安全、测试、部署、开发规范，以及项目当前状态（[长期记忆](docs/99_management/01_项目长期记忆.md)）。

## 目录结构

```
.
├── frontend/            Next.js 16 前端（App Router + React 19 + Tailwind）
├── backend/
│   ├── api/             Spring Boot 4 API（Java 21 + MyBatis + Flyway + MySQL）
│   └── video-worker/    视频渲染 Worker（轮询 QUEUED 任务，调用 FFmpeg 生成 MP4）
├── e2e/                 端到端测试（真实浏览器 + 真实服务）
├── docs/                项目设计文档体系（入口 docs/README.md）
├── AI开发执行指令/       历次给 AI 的开发指令原文（历史资料）
└── 启动TabiTrace前后端.bat
```

## 本地启动

**最省事**：双击根目录的 `启动TabiTrace前后端.bat`，会分别打开后端、视频渲染服务、前端、开发邮件接收器窗口（已在运行的不会重复启动）。找到 FFmpeg 时自动启用真实视频渲染；找不到时后端改用模拟渲染器，视频只走状态流程、不能播放。数据库需要先按下面第 1 步初始化。

手动启动：

1. **数据库**：MySQL 8，先执行 `backend/scripts/mysql-init-local.sql` 创建库和 `tabitrace_app` 账号；表结构由 Flyway 在 API 启动时自动建好。
2. **后端 API**：`mvn -f backend/pom.xml -pl api spring-boot:run` → http://localhost:8080/api/v1
3. **前端**：`cd frontend && npm install && npm run dev` → http://localhost:3000
4. **邮件接收器**（注册收验证码）：`node backend/scripts/dev-mail-catcher.mjs` → http://127.0.0.1:1080
5. **视频渲染（可选）**：需要本机安装 FFmpeg，见 [新手上手指南](docs/09_deployment/03_新手上手指南.md)。

配置项全部走环境变量，参考 [backend/.env.example](backend/.env.example) 与 [frontend/.env.local.example](frontend/.env.local.example)，说明见 [环境与配置](docs/09_deployment/01_环境与配置说明.md)。仓库里出现的 `tabitrace_dev`、`*-change-me-*` 等都是**仅限本地开发的默认值**，生产环境必须替换（`prod` profile 会拒绝弱密钥）。部署见 [部署设计](docs/09_deployment/02_部署设计.md)。

## 不在仓库里的东西

`.gitignore` 排除了：依赖与构建产物、`.tools/`（本地 FFmpeg 二进制）、日志、`.tabitrace/` 与 `backend/.tabitrace/`（本地上传、曲库音频）、`frontend/public/generated-videos/`（渲染出的视频）、`frontend/public/vendor/maplibre-gl/`（构建时生成）以及所有 `.env` 文件（示例文件除外）。
