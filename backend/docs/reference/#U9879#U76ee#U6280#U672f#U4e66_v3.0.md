# 旅迹 TabiTrace 项目技术书 v3.0

> 文档状态：最新技术基线  
> 基于：项目技术书 v2.0、MVP 最新功能范围、旅行视频功能计划、Frontend Demo v6  
> 更新时间：2026-09-15

---

## 1. 项目定位与技术目标

TabiTrace 是一个全球旅行打卡、记录与旅行纪念平台。

技术系统需要支撑：

```text
账号
旅行
行程
地点
打卡
时间轴
照片
地图
统计
成就
分享图
分享链接
旅行视频
Trip Pro
```

技术原则继续保持：

```text
简单
稳定
熟悉
低成本
可维护
可扩展
```

不因为新增旅行视频和分享能力而提前引入不必要的复杂架构。

---

# 2. 当前前端 Demo 技术基线

当前 Frontend Demo v6 已采用正式前端技术方向，而不再是纯 HTML 原型。

## 2.1 当前 Demo 依赖

```text
Next.js 16.3.3
React 19.2.0
TypeScript 5.7.x
Tailwind CSS 3.4.x
Framer Motion 12.x
Lucide React
MapLibre GL JS 5.6.x
html-to-image 1.11.x
```

使用：

```text
Next.js App Router
```

正式项目初始化 / 升级时仍应重新核验当时可用安全 Patch，并通过 lockfile 锁定依赖。

---

# 3. 系统总体架构

正式 MVP：

```text
                         User
                           │
                         HTTPS
                           │
                           ▼
                     Cloudflare
                  DNS / CDN / SSL
                           │
                           ▼
                  Amazon Lightsail
                      Ubuntu
                           │
                         Nginx
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
            Next.js               Spring Boot
           Frontend                REST API
                                       │
                                  MySQL 8.4
                                       │
                  ┌────────────────────┼──────────────────┐
                  │                    │                  │
                  ▼                    ▼                  ▼
           Cloudflare R2           Stripe          Map Services
          Photos / Videos        Checkout          Tile / Geocode
                                       │
                                       ▼
                              Video Render Worker
                             Remotion / FFmpeg
```

视频 Worker 在逻辑上独立，即使 MVP 初期与应用部署在同一台 Lightsail。

---

# 4. 前端架构

## 4.1 正式前端技术

```text
Next.js 16
React
TypeScript
Tailwind CSS
Framer Motion
Lucide
MapLibre GL JS
html-to-image
```

主要职责：

- 页面展示
- 账号流程
- 旅行创建与管理
- 官方探索
- 行程规划
- 自定义地点输入
- 地图 UI
- 打卡与时间轴
- 照片管理
- 成就展示
- 旅行总结
- 分享图片生成
- 视频项目配置与预览
- Trip Pro / Checkout 入口
- 分享访问页

---

# 5. 当前前端路由基线

Frontend Demo v6 已验证以下信息架构：

```text
/
首页

/login
登录

/register
注册

/trips
我的旅行

/trips/new
创建旅行

/trip-demo
旅行工作台：地图 / 行程 / 打卡 / 时间轴

/gallery-demo
旅行照片与精选素材

/achievements-demo
旅行成就

/summary-demo
旅行总结

/share-demo
分享成果生成器

/video-demo
Travel Story 视频项目

/explore
官方城市入口

/explore/tokyo
东京官方探索

/pricing
Trip Pro

/profile
个人资料 / 隐私 / 时区 / 通知

/s/tokyo-demo
UNLISTED 分享落地页
```

正式项目应映射为动态旅行 ID 路由，例如：

```text
/trips/{id}
/trips/{id}/map
/trips/{id}/gallery
/trips/{id}/achievements
/trips/{id}/summary
/trips/{id}/share
/trips/{id}/video
```

---

# 6. 前端组件结构建议

```text
frontend/
│
├── app/
│   ├── page.tsx
│   ├── login/
│   ├── register/
│   ├── trips/
│   │   ├── page.tsx
│   │   ├── new/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── map/
│   │       ├── gallery/
│   │       ├── achievements/
│   │       ├── summary/
│   │       ├── share/
│   │       └── video/
│   ├── explore/
│   ├── pricing/
│   ├── profile/
│   └── s/[token]/
│
├── components/
│   ├── common/
│   ├── map/
│   ├── trip/
│   ├── itinerary/
│   ├── checkin/
│   ├── timeline/
│   ├── gallery/
│   ├── achievement/
│   ├── share/
│   ├── video/
│   └── payment/
│
├── services/
├── hooks/
├── lib/
├── types/
├── constants/
└── public/
```

---

# 7. Demo 状态与正式状态的边界

当前 Demo 使用：

```text
Mock Data
+
React State
+
localStorage
```

验证产品体验。

已使用 / 类似使用的本地状态包括：

- 打卡数据
- 自定义地点
- 计划行程
- 官方地点加入旅行
- 照片精选
- 模拟登录状态
- 分享状态

正式 MVP 必须全部迁移到后端与数据库，不依赖浏览器 localStorage 保存业务主数据。

localStorage 在正式产品中仅适合：

- 临时草稿
- UI 偏好
- 非敏感缓存

---

# 8. 地图技术

地图渲染：

# MapLibre GL JS

Demo 当前使用空白本地 Style + Mock 经纬度 + Marker / Route 验证交互，因此无需 API Key。

正式 MVP 需要拆分：

```text
MapLibre
= 地图渲染

Tile Provider
= 地图瓦片

Geocoding Provider
= 地点搜索 / 地址解析
```

上线前需要针对：

- 日本地点准确率
- 全球覆盖
- 中文搜索
- 日文搜索
- 价格
- 商业使用条款

进行最终服务选型。

---

# 9. 行程规划技术模型

最新版前端已经加入“手动输入行程”，因此正式数据模型需要增加行程实体。

推荐新增：

# itinerary_items

```text
id BIGINT PK
trip_id BIGINT
place_id BIGINT NULL
custom_place_name VARCHAR(200) NULL
area VARCHAR(100) NULL
planned_date DATE
planned_time TIME NULL
note TEXT NULL
latitude DECIMAL(10,7) NULL
longitude DECIMAL(10,7) NULL
status VARCHAR(20)
sort_order INT
created_at DATETIME
updated_at DATETIME
```

status：

```text
PLANNED
DONE
CANCELLED
```

说明：

- 官方 / 已存在地点使用 place_id
- 尚未标准化的手动地点可以先保存文本与坐标
- 用户执行“完成打卡”时创建 Checkin，并将 itinerary_items.status 更新为 DONE

---

# 10. Place 模型

places：

```text
id BIGINT PK
name VARCHAR(200)
country_code VARCHAR(10)
country VARCHAR(100)
city VARCHAR(100)
area VARCHAR(100)
address VARCHAR(500)
latitude DECIMAL(10,7)
longitude DECIMAL(10,7)
category VARCHAR(50)
source_type VARCHAR(20)
description TEXT
cover_image VARCHAR(500)
created_at DATETIME
updated_at DATETIME
```

source_type：

```text
OFFICIAL
CUSTOM
```

用户自定义地点不要求必须有完整坐标；没有坐标时仍可记录，但不会以精确 Marker 出现在地图中。

---

# 11. Trip / TripPlace

trips：

```text
id BIGINT PK
user_id BIGINT
title VARCHAR(200)
destination_name VARCHAR(200)
country_code VARCHAR(10)
city VARCHAR(100)
start_date DATE
end_date DATE
people_count INT
cover_image VARCHAR(500)
plan_type VARCHAR(20)
status VARCHAR(30)
visibility VARCHAR(20)
created_at DATETIME
updated_at DATETIME
```

plan_type：

```text
FREE
PRO
```

status：

```text
PLANNING
ONGOING
COMPLETED
ARCHIVED
```

visibility：

```text
PRIVATE
UNLISTED
```

trip_places 继续负责旅行与标准地点的引用关系：

```text
id
trip_id
place_id
sort_order
created_at
```

具体计划日期 / 时间改由 itinerary_items 管理。

---

# 12. Checkin 模型

checkins：

```text
id BIGINT PK
trip_id BIGINT
place_id BIGINT NULL
user_id BIGINT
itinerary_item_id BIGINT NULL
checkin_type VARCHAR(20)
checkin_time DATETIME
latitude DECIMAL(10,7) NULL
longitude DECIMAL(10,7) NULL
place_name_snapshot VARCHAR(200)
area_snapshot VARCHAR(100)
note TEXT
created_at DATETIME
updated_at DATETIME
```

checkin_type：

```text
MANUAL
GPS
```

MVP：

```text
MANUAL
```

增加 snapshot 字段的原因：用户自定义地点或地点名称后期发生变化时，历史时间轴仍保持当时显示内容。

---

# 13. 时间轴

时间轴不需要单独存一份重复数据。

默认由：

```text
Checkin
+
Photo
+
Itinerary
```

按时间聚合生成。

MVP 主时间轴查询：

```text
旅行
↓
按日期分组
↓
按 checkin_time 排序
↓
地点 + 旅行文字 + 关联照片
```

后续如加入更多事件类型，可以抽象 timeline_events，但首版不需要。

---

# 14. Photos 模型

photos：

```text
id BIGINT PK
user_id BIGINT
trip_id BIGINT
checkin_id BIGINT NULL
storage_key VARCHAR(500)
image_url VARCHAR(1000)
width INT
height INT
file_size BIGINT
mime_type VARCHAR(100)
is_featured BOOLEAN DEFAULT FALSE
captured_at DATETIME NULL
created_at DATETIME
```

`is_featured` 用于最新 Demo 中的“精选素材”。

分享图和旅行视频默认选图策略：

```text
精选照片优先
↓
不同日期 / 地点代表照片
↓
系统补足其他照片
```

---

# 15. 图片上传与存储

真实文件存储：

# Cloudflare R2

不要将图片二进制存入 MySQL。

推荐流程：

```text
Frontend
↓
请求 Presigned Upload
↓
Browser 直接上传 R2
↓
Backend 保存 Photo Metadata
```

浏览器上传前：

- MIME 检查
- 大小检查
- Resize
- 压缩
- WebP 转换

建议最大边长约 2000px，质量约 0.80～0.85。

---

# 16. Achievement 模型

achievements：

```text
id
code
name
description
type
city_code NULL
icon_url
condition_type
condition_value
created_at
```

type：

```text
GLOBAL
CITY
```

user_achievements：

```text
id
user_id
trip_id NULL
achievement_id
earned_at
```

初期不使用通用规则引擎。

`AchievementService` 在事件发生时检查：

```text
CHECKIN_CREATED
PHOTO_UPLOADED
TRIP_COMPLETED
```

---

# 17. 旅行总结

Summary API 由后端聚合：

```text
旅行天数
地点数
照片数
城市数
区域数
官方地点完成数
探索度
成就数
每日记录状态
```

旅行完成后：

```text
trips.status = COMPLETED
```

但完成旅行不会自动改变分享权限。

---

# 18. 分享图片技术

当前 Demo 已验证：

```text
HTML / CSS
+
html-to-image
↓
PNG
```

三种模板：

```text
城市海报
九图故事
每日长图
```

正式 MVP 继续采用浏览器生成 PNG。

Free / Pro 可以通过：

- pixelRatio
- 模板权限
- 水印
- 输出尺寸

实现差异。

如果后续出现不同设备字体 / 布局不一致，再迁移为服务端 Headless Chrome 渲染。

---

# 19. ShareLink 与隐私模型

share_links：

```text
id BIGINT PK
trip_id BIGINT
share_token VARCHAR(100)
status VARCHAR(20)
view_count BIGINT
created_at DATETIME
expires_at DATETIME NULL
revoked_at DATETIME NULL
```

status：

```text
ACTIVE
REVOKED
EXPIRED
```

流程：

```text
Trip 默认 PRIVATE
↓
用户主动生成链接
↓
创建 ACTIVE ShareLink
↓
Trip 展示为 UNLISTED
↓
持 token 用户可访问
↓
撤销链接
↓
ShareLink REVOKED
↓
Trip 恢复 PRIVATE
```

首版不实现 PUBLIC 内容广场。

---

# 20. 旅行视频 / Travel Story

前端 Demo 已验证完整视频配置流程，但浏览器不负责真实 MP4 编码。

正式架构：

```text
Next.js
↓
Spring Boot
↓
创建 Video Project
↓
MySQL
↓
Video Render Worker
↓
Remotion / FFmpeg
↓
H.264 + AAC MP4
↓
Cloudflare R2
```

首版规格：

```text
9:16
30 秒
MP4
```

Free：

```text
720 × 1280
最多 10 张照片
基础模板
水印
```

Pro：

```text
1080 × 1920
更多照片
全部模板
更多音乐
高级地图动画
完整成就
无水印
```

---

# 21. video_projects

```text
id BIGINT PK
user_id BIGINT
trip_id BIGINT
template_code VARCHAR(50)
aspect_ratio VARCHAR(20)
duration INT
music_code VARCHAR(50)
show_text BOOLEAN
show_map BOOLEAN
show_achievements BOOLEAN
status VARCHAR(30)
progress INT
output_key VARCHAR(500)
output_url VARCHAR(1000)
error_message TEXT NULL
created_at DATETIME
updated_at DATETIME
completed_at DATETIME NULL
```

status：

```text
DRAFT
QUEUED
PROCESSING
COMPLETED
FAILED
```

---

# 22. video_project_photos

```text
id BIGINT PK
video_project_id BIGINT
photo_id BIGINT
sort_order INT
duration DECIMAL(5,2) NULL
created_at DATETIME
```

音乐与模板首版可以先用代码 / 配置文件维护，正式运营后再按需要数据库化为：

```text
video_music
video_templates
```

---

# 23. Video Worker

MVP 初期：

```text
同一台 Lightsail
```

可以运行：

```text
Next.js
Spring Boot
MySQL
Video Worker
```

但 Worker 必须是独立进程。

原因：

- CPU 消耗高
- 内存消耗高
- 渲染时间长
- 失败重试与普通 API 生命周期不同

正式用户增长后可拆到独立实例。

---

# 24. 视频任务调度

第一阶段不必直接引入 Kafka / RabbitMQ。

用户量小可以采用：

```text
video_projects.status = QUEUED
↓
Worker 定时拉取 / DB Queue
↓
PROCESSING
↓
COMPLETED / FAILED
```

当真实渲染量增长后再增加专业消息队列。

---

# 25. Backend 技术基线

```text
Java 21 LTS
Spring Boot 4.1.x
Maven
Spring Web
Spring Security
Spring Validation
Spring Actuator
MyBatis
Flyway
MySQL Connector/J
JWT
JUnit 5
Mockito
```

分层：

```text
Controller
↓
Service
↓
Mapper
↓
MySQL
```

不在首版使用复杂 DDD / CQRS / Microservices。

---

# 26. Backend 模块

最新版建议包结构：

```text
com.tabitrace
├── auth
├── user
├── trip
├── itinerary
├── place
├── checkin
├── photo
├── achievement
├── summary
├── share
├── video
├── payment
├── city
├── common
├── security
└── config
```

每个业务模块按需包含：

```text
controller
service
mapper
entity
dto
request
response
```

---

# 27. API 基线

Base URL：

```text
/api/v1
```

统一 Response：

```json
{
  "success": true,
  "data": {}
}
```

错误：

```json
{
  "success": false,
  "code": "TRIP_NOT_FOUND",
  "message": "旅行不存在"
}
```

---

# 28. Auth / User API

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/users/me
PUT  /api/v1/users/me
```

用户设置需支持：

- nickname
- locale
- timezone
- default_visibility
- email_notifications

建议 users 增加：

```text
locale VARCHAR(20)
timezone VARCHAR(50)
default_visibility VARCHAR(20)
email_notifications BOOLEAN
```

---

# 29. Trip API

```text
POST   /api/v1/trips
GET    /api/v1/trips
GET    /api/v1/trips/{id}
PUT    /api/v1/trips/{id}
DELETE /api/v1/trips/{id}
POST   /api/v1/trips/{id}/complete
GET    /api/v1/trips/{id}/summary
```

---

# 30. Itinerary API

```text
POST   /api/v1/trips/{tripId}/itinerary
GET    /api/v1/trips/{tripId}/itinerary
PUT    /api/v1/trips/{tripId}/itinerary/{itemId}
DELETE /api/v1/trips/{tripId}/itinerary/{itemId}
POST   /api/v1/trips/{tripId}/itinerary/{itemId}/checkin
```

---

# 31. Place / Official City API

```text
GET  /api/v1/places/search
GET  /api/v1/places/{id}
POST /api/v1/trips/{tripId}/places
POST /api/v1/trips/{tripId}/places/custom
DELETE /api/v1/trips/{tripId}/places/{placeId}

GET /api/v1/official-cities
GET /api/v1/official-cities/{code}
GET /api/v1/official-cities/{code}/places
POST /api/v1/trips/{tripId}/official-places/{placeId}
```

---

# 32. Checkin API

```text
POST   /api/v1/trips/{tripId}/checkins
GET    /api/v1/trips/{tripId}/checkins
PUT    /api/v1/checkins/{id}
DELETE /api/v1/checkins/{id}
```

后端所有接口必须校验：

```text
trip.user_id == currentUser.id
```

---

# 33. Photo API

```text
POST /api/v1/trips/{tripId}/photos/presign
POST /api/v1/trips/{tripId}/photos
GET  /api/v1/trips/{tripId}/photos
PUT  /api/v1/photos/{id}
DELETE /api/v1/photos/{id}
POST /api/v1/photos/{id}/feature
DELETE /api/v1/photos/{id}/feature
```

---

# 34. Achievement API

```text
GET /api/v1/trips/{tripId}/achievements
```

用户不直接提交“获得成就”，由后端规则计算。

---

# 35. Share API

```text
POST   /api/v1/trips/{tripId}/share-links
GET    /api/v1/trips/{tripId}/share-links
DELETE /api/v1/trips/{tripId}/share-links/{shareId}
GET    /api/v1/share/{token}
```

分享图片 PNG MVP 仍主要由前端生成，不强制先上传服务器。

---

# 36. Video API

建议：

```text
POST /api/v1/trips/{tripId}/video-projects
GET  /api/v1/trips/{tripId}/video-projects
GET  /api/v1/video-projects/{id}
PUT  /api/v1/video-projects/{id}
POST /api/v1/video-projects/{id}/render
DELETE /api/v1/video-projects/{id}
```

`GET /video-projects/{id}` 返回：

```text
status
progress
outputUrl
errorMessage
```

前端轮询即可支撑 MVP；暂不需要 WebSocket。

---

# 37. Payment

正式采用：

# Stripe Checkout + Webhook

商品：

```text
Trip Pro
¥490 / 次旅行
```

流程：

```text
Frontend
↓
POST /payments/checkout
↓
Spring Boot 创建 Checkout Session
↓
Stripe Hosted Checkout
↓
Stripe Webhook
↓
payments = PAID
↓
trips.plan_type = PRO
```

绝不能通过 success redirect 直接判定支付成功。

---

# 38. Payment API

```text
POST /api/v1/trips/{tripId}/payments/checkout
POST /api/v1/payments/stripe/webhook
GET  /api/v1/trips/{tripId}/payments/latest
```

Trip Pro 权限仍然绑定旅行，而不是 `users.is_pro`。

---

# 39. MySQL 数据库基线

```text
MySQL 8.4 LTS
utf8mb4
UTC 时间
Flyway Migration
```

建议核心表更新为：

```text
users
trips
places
trip_places
itinerary_items
checkins
photos
official_cities
achievements
user_achievements
payments
share_links
video_projects
video_project_photos
```

后期再按实际需要增加：

```text
place_translations
video_templates
video_music
```

---

# 40. Timezone

数据库事件时间统一按 UTC 保存。

旅行日期字段：

```text
DATE
```

具体到访时间：

```text
DATETIME / TIMESTAMP
```

前端根据：

```text
users.timezone
```

进行展示。

这对全球旅行和跨时区记录必须从第一版开始正确设计。

---

# 41. 用户认证与安全

MVP：

```text
Email + Password
Spring Security
BCrypt
JWT Access Token + Refresh Token
```

Refresh Token 需要支持：

- 注销
- 失效
- 重新签发

禁止：

- 明文密码
- MD5
- SHA1

---

# 42. 权限校验

所有私人业务数据必须基于：

```text
currentUser.id
```

进行所有权校验。

UNLISTED 分享页属于例外：

- 不要求登录
- 必须持有效 share_token
- 只返回允许公开的旅行成果字段
- 不泄露用户邮箱、私人设置等信息

---

# 43. 部署

MVP：

# Amazon Lightsail Ubuntu

推荐约：

```text
2 vCPU
4 GB RAM
80 GB SSD
```

首期部署：

```text
/opt/tabitrace/
├── frontend/
├── backend/
├── video-worker/
├── logs/
├── scripts/
└── backups/
```

Systemd：

```text
tabitrace-web.service
tabitrace-api.service
tabitrace-video-worker.service
```

---

# 44. Nginx

Nginx：

```text
/
→ Next.js

/api/
→ Spring Boot
```

负责：

- HTTPS
- Reverse Proxy
- 静态资源
- 压缩
- 访问日志

生产环境 HTTPS ONLY。

---

# 45. Cloudflare

Cloudflare 负责：

- DNS
- CDN
- SSL
- 基础安全
- Rate Limit

Cloudflare R2 保存：

- 旅行照片
- 真实旅行视频 MP4
- 视频封面 / 缩略图（如需要）

---

# 46. CI/CD

GitHub Monorepo 推荐：

```text
tabitrace/
├── frontend
├── backend
└── video-worker
```

GitHub Actions：

```text
Push
↓
Frontend build / typecheck / test
Backend test / package
Worker build / test
↓
Deploy
```

正式前端至少执行：

```text
npm ci
npm run typecheck
npm run build
```

---

# 47. 测试

Frontend：

```text
Vitest
React Testing Library
Playwright
```

核心前端流程：

- 注册 / 登录
- 创建旅行
- 添加行程
- 添加自定义地点
- 打卡
- 时间轴更新
- 照片精选
- 分享图生成
- 分享链接创建 / 撤销
- Video Project 配置
- Pricing / Checkout

Backend：

```text
JUnit 5
Mockito
Testcontainers（后期集成测试）
```

---

# 48. Monitoring

```text
Spring Actuator
Sentry
Logback
PostHog / Google Analytics
```

视频 Worker 需要额外记录：

- render start
- render duration
- render success
- render failure
- FFmpeg exit code
- R2 upload result

---

# 49. 产品埋点

最新建议事件：

```text
HOME_VIEW
REGISTER_COMPLETED
LOGIN_COMPLETED
TRIP_CREATED
ITINERARY_ITEM_CREATED
CUSTOM_PLACE_CREATED
FIRST_CHECKIN
FIFTH_CHECKIN
TENTH_CHECKIN
CHECKIN_NOTE_SAVED
PHOTO_UPLOADED
PHOTO_FEATURED
ACHIEVEMENT_EARNED
TRIP_COMPLETED
SHARE_CARD_CREATED
SHARE_IMAGE_DOWNLOADED
SHARE_LINK_CREATED
SHARE_LINK_REVOKED
SHARE_LINK_VIEWED
VIDEO_PROJECT_CREATED
VIDEO_RENDER_STARTED
VIDEO_RENDER_SUCCESS
VIDEO_DOWNLOADED
VIDEO_SHARE_CLICK
PRO_CLICK
CHECKOUT_STARTED
PAYMENT_SUCCESS
```

支付成功指标以服务端 Stripe Webhook 为准。

---

# 50. Backup

至少：

- MySQL 每日备份
- 备份上传 R2
- 定期恢复演练
- R2 图片 / 视频考虑版本策略与误删除防护

建议：

```text
每日 7 天
每周 4 周
每月 6 个月
```

---

# 51. 版本阶段

## Phase 0：Frontend Demo

当前已完成较完整的前端产品验证：

- Next.js 信息架构
- 账号页面
- 旅行列表与创建
- 地图
- 行程
- 自定义地点
- 打卡
- 时间轴
- 照片 / 精选素材
- 成就
- 旅行总结
- 三种分享图
- PRIVATE / UNLISTED
- Pricing
- Travel Story

## Phase 1：正式 MVP

真实实现：

- Spring Boot API
- MySQL
- R2
- 真实地图 / Geocoding
- Stripe
- 产品埋点
- 生产部署

优先完成图片分享成果。

## Phase 1.x：Video Render

基础 MVP 稳定后：

- video_projects
- Video Worker
- Remotion / FFmpeg
- R2 MP4
- 视频分享页

## Phase 2：运营

- PWA
- GPS 验证
- 多语言
- 更多官方城市
- Admin

## Phase 3：Scale

真实负载出现后再考虑：

- Managed MySQL
- Redis
- 消息队列
- 多实例
- Load Balancer
- App

---

# 52. 明确不引入的技术

当前阶段不使用：

```text
Kubernetes
Microservices
Kafka
RabbitMQ
Elasticsearch
Redis Cluster
Service Mesh
GraphQL
MongoDB
多数据库架构
```

视频任务初期使用数据库队列即可；只有真实视频生成量证明需要时再增加消息队列。

---

# 53. 当前技术重点

最新版项目最重要的四个技术重点变为：

### 1. 旅行记录一致性

```text
行程 → 打卡 → 时间轴 → 地图 → 统计 → 成就
```

必须保持一致。

### 2. 照片与成果输出

照片上传、精选和分享图必须稳定且视觉一致。

### 3. 分享隐私

PRIVATE / UNLISTED、链接撤销与匿名访问边界必须可靠。

### 4. Trip Pro 与视频渲染

Stripe 权限必须可靠；视频渲染必须与 Web API 解耦。

---

# 54. 最终技术基线

```text
Frontend
Next.js 16
React 19
TypeScript
Tailwind CSS
Framer Motion
Lucide
MapLibre GL JS
html-to-image
```

```text
Backend
Java 21
Spring Boot 4.1.x
Spring Security
MyBatis
Flyway
JWT
JUnit 5
Mockito
```

```text
Data
MySQL 8.4 LTS
Cloudflare R2
```

```text
Payment
Stripe Checkout + Webhook
```

```text
Video
Remotion / FFmpeg
独立 Video Worker
H.264 + AAC MP4
```

```text
Infrastructure
Amazon Lightsail
Ubuntu
Nginx
Cloudflare
GitHub
GitHub Actions
```

---

# 55. 最终结论

TabiTrace 的正式技术路线不需要因为功能增加而变成大型复杂系统。

核心架构仍然是：

```text
Next.js
↓
Spring Boot
↓
MySQL
```

旁路能力：

```text
R2
Stripe
Map Services
Video Worker
```

当前前端 Demo 已经验证了产品从：

```text
旅行规划
↓
打卡记录
↓
时间轴
↓
照片与成就
↓
旅行总结
↓
图片 / 视频成果
↓
分享 / Pro
```

的完整前端链路。

下一阶段技术工作的重点不是继续扩大 Demo 功能，而是逐步把这些已经验证过的前端状态，替换为真实 API、数据库、存储、支付和渲染任务。
