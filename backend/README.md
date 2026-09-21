# TabiTrace Backend v5 · Integrated

旅迹 TabiTrace 独立后端工程。该版本来自 Fullstack Integration v2 深度联调后的 Spring Boot 后端，包含本轮权限、统计、图片、Stripe 与视频任务修正。

## 技术栈

- Java 21
- Spring Boot 4.1.1
- Maven multi-module
- Spring Security / Validation / Actuator
- MyBatis
- Flyway
- MySQL 8.4 LTS
- JWT Access Token + Refresh Token
- Cloudflare R2 Presigned Upload（local 模式支持本地二进制 PUT）
- Stripe Checkout + Webhook（local 可 Mock）
- 独立 Video Worker + FFmpeg

## 模块

```text
TabiTrace-Backend-v4/
├── api/                 Spring Boot REST API
├── video-worker/        独立视频渲染 Worker
├── docs/                API / 设计说明
├── deploy/              Nginx / systemd 示例
├── scripts/             数据库备份脚本
├── docker-compose.yml   本地 MySQL 8.4
└── pom.xml
```

## 本地启动

### 1. 启动 MySQL

有 Docker：

```bash
docker compose up -d mysql
```

没有 Docker 时，用本机 MySQL（8.0 及以上）管理员账号执行初始化脚本，创建 `tabitrace` 库与 `tabitrace_app` 账号：

```bash
mysql -u root -p -e "source scripts/mysql-init-local.sql"
```

表结构与东京种子数据会在 API 首次启动时由 Flyway 自动创建，无需手工建表。配置参考 `.env.example`。

### 2. 配置环境变量

参考：

```text
.env.example
```

local profile 可使用本地图片存储与 Mock Stripe，正式环境再切换 R2 / Stripe Secret。

### 3. 启动 API

```bash
mvn -pl api spring-boot:run
```

默认：

```text
http://localhost:8080
http://localhost:8080/api/v1
```

### 4. 启动视频 Worker（需要时）

```bash
mvn -pl video-worker spring-boot:run
```

真实视频渲染还需要系统安装 FFmpeg，并按环境变量配置 Worker、R2 与音乐资源。

Local profile 默认启用 API 内置视频模拟渲染器，便于前端联调。启动真实 Worker 前请设置 `VIDEO_MOCK_RENDERER=false`，避免 API 模拟渲染器与 Worker 争抢同一批 `QUEUED` 任务。

模拟渲染器只会把任务标成 `COMPLETED` 并写入 `https://example.invalid/videos/<id>.mp4` 占位地址，**这个地址不能播放**。要在前端看到可播放的视频，按下面三步：

```bash
# 1. 安装 FFmpeg（Windows，装完需重开终端才会进 PATH）
winget install --id Gyan.FFmpeg -e

# 2. API 关掉模拟渲染器（.claude/launch.json 里的 tabitrace-api 已带这个参数）
mvn -f backend/pom.xml -pl api spring-boot:run -Dspring-boot.run.arguments=--app.video.mock-renderer-enabled=false

# 3. 启动 Worker（从仓库根目录执行；默认输出到 frontend/public/generated-videos，音乐读 frontend/public/music）
STORAGE_MODE=local mvn -f backend/pom.xml -pl video-worker spring-boot:run
```

Worker 没有 HTTP 端口，只轮询数据库里的 `QUEUED` 任务。成品地址形如 `http://localhost:3000/generated-videos/project-<id>/output.mp4`，由前端 dev server 直接提供。

### 生产环境注意

- `prod` profile 启动时会校验 `JWT_SECRET`：未设置、短于 32 字节或仍包含 `change-me` 的开发默认值会直接启动失败。

## 已实现主要能力

- 注册 / 登录 / Refresh / Logout
- 旅行 CRUD 与 FREE / PRO 状态
- 旅行归档 / 取消归档：归档旅行只读、不占用 FREE 名额；FREE 旅行取消归档时仍受 1 个名额限制
- 东京官方城市与地点
- 自定义地点与旅行归属校验
- 手动行程、行程转打卡、直接补录打卡
- 时间轴 / 统计 / 总结 / 成就
- 图片授权、local 二进制 PUT、R2 Presigned Upload、元数据、精选素材
- PRIVATE / UNLISTED 分享链接与撤销
- Stripe Checkout / Webhook 与单次旅行 Pro
- 旅行视频草稿、照片顺序、模板/音乐参数、队列/进度状态
- Video Worker / FFmpeg 输出结构

## 深度联调修正

- 官方探索与总结地点按唯一地点计数
- 时间轴照片时间按用户时区展示
- 自定义地点禁止跨旅行复用
- 行程/打卡跨旅行归属校验
- 图片 storageKey / MIME / 大小 / 路径安全校验
- 登记照片前校验对象确实已上传（local 查文件，R2 调用 HeadObject）
- local 模式上传 URL 带 15 分钟有效的 HMAC 签名，未签名请求返回 403
- 图片 URL 由服务端生成
- Stripe 仅在 `payment_status=paid` 后升级 Pro
- 视频模板、音乐、照片重复和 MVP 参数校验

前端请使用本轮联调后的 `TabiTrace-Frontend-v4-Integrated` 工程。

## v5 联调修正

- Local profile 默认启用 Video Mock Renderer，使前端 Travel Story 在不启动 Worker 时也能走完状态流。
- 与 Frontend v4 重新核对 Archive / Place Search / Photo / Share / Payment / Video API。
- 前端 API Client 状态化 Mock 联调 15 / 15 业务组通过。
- POM 与 YAML 配置解析检查通过。

## v6 Integrated 联调修正

- Logout 改为幂等：Access Token 失效时仍可通过 Refresh Token 撤销服务端会话。
- 本地 CORS 默认兼容 `localhost:3000` 与 `127.0.0.1:3000`。
- Video Worker 默认 `FFMPEG_BINARY=ffmpeg`，不再绑定 Windows 相对路径。
- 新增 `AuthServiceLogoutTest` 回归测试。
