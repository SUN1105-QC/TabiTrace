# 旅迹 TabiTrace Frontend v5.0 · Warm Workspace Fixed

基于 Warm Workspace 主题与 Backend v5 的二次深度检查修正版。

## 技术基线

- Next.js 16.3.3 / App Router
- React 19.2
- TypeScript 5.7
- Tailwind CSS 3.4
- Framer Motion 12
- Lucide React
- MapLibre GL JS 5.6
- html-to-image 1.11

## 视觉基线

沿用第四版 Warm Workspace：

- 暖白 / 米杏背景
- 橙棕主色
- 墨色标题
- 柔和卡片与轻阴影
- 旅行实景照片
- PC：左侧导航 + 顶部搜索 + 工作区
- Mobile：单栏页面 + 底部导航

## 正式路由

```text
/
/login
/register
/trips
/trips/new
/trips/[id]
/trips/[id]/map
/trips/[id]/gallery
/trips/[id]/achievements
/trips/[id]/summary
/trips/[id]/share
/trips/[id]/video
/explore
/explore/tokyo
/pricing
/profile
/s/[token]
```

`/trips/[id]/photos` 保留为兼容重定向到 `/gallery`。

## 与后端互通

前端按技术书使用统一 API：

```text
/api/v1
```

复制环境变量：

```bash
cp .env.local.example .env.local
```

默认：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

认证采用 Access Token + Refresh Token。Access Token 过期后，API Client 会自动请求 `/auth/refresh` 并重试原请求。

## 启动

建议 Node.js 20 / 22 LTS。

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

构建：

```bash
npm run typecheck
npm run build
npm start
```

## 当前已接真实 API 的功能

- 注册 / 登录 / Token Refresh / Logout
- 我的旅行 / 创建旅行 / 旅行详情
- 官方地点 / 自定义地点
- 手动行程
- 行程转打卡 / 直接打卡 / 撤销打卡
- 旅行时间轴
- MapLibre 地图与路线
- Presigned 图片上传 / Photo Metadata
- 精选照片
- 旅行统计 / 成就 / 旅行完成
- 分享 PNG：城市海报 / 九宫格 / 每日长图
- PRIVATE / UNLISTED 分享链接
- Travel Story 视频项目配置 / 渲染任务 / 进度
- Trip Pro Stripe Checkout 入口
- 用户资料、语言、时区、隐私与通知设置

## 图片上传

正式流程：

```text
Browser
→ POST /trips/{id}/photos/presign
→ PUT R2 Presigned URL
→ POST /trips/{id}/photos
```

本地后端处于 Local Storage 模式时，同一前端代码也可以直接上传到 Spring Boot 提供的本地 PUT 地址。

## Travel Story

前端只负责：

- 模板
- 照片
- 音乐
- 显示旅行文字 / 地图 / 成就
- 任务创建与进度轮询

真实 MP4 由后端 Video Worker + Remotion / FFmpeg 生成。

## 目录

```text
app/          App Router 页面
components/
  common/    品牌、桌面/移动导航、公共 UI
  map/       MapLibre 地图
  trip/      单次旅行导航组件
services/     API Client、JWT Refresh、业务 Service
hooks/        前端辅助状态
constants/    产品常量
public/       第四版暖色主题图片资产
```

## 注意

正式 MVP 业务数据不依赖 localStorage。localStorage 仅保存 JWT Token 与“最近一次打开的旅行 ID”这类前端会话辅助信息。

## v4 联调修正

- 补齐 Trip `archive / unarchive` API 与页面操作。
- 旅行子页面自动同步“最近打开旅行 ID”，避免直接访问子路由后侧边栏仍指向旧旅行。
- 地图加入可配置 `NEXT_PUBLIC_MAP_STYLE_URL`；本地未配置时使用 OpenStreetMap raster 作为开发回退底图。
- 地图根据当前旅行地点自动 Fit Bounds。
- 地图工作台增加官方地点搜索并直接加入当前旅行。
- Travel Story 前端限制与后端一致：FREE 最多 10 张、PRO 最多 30 张；CITY 模板在 FREE 状态提前提示。
- 本地 Video Mock 完成时不再打开无效 `example.invalid` 地址，而是提示启用真实 Worker。
- Mock Stripe 支付成功后直接刷新当前 Trip Pro 状态。
- 个人中心补充 Logout，与后端 `/auth/logout` 对齐。

## 地图本地开发

如果已有正式 Tile Provider / Map Style：

```env
NEXT_PUBLIC_MAP_STYLE_URL=https://your-map-provider/style.json
```

未配置时仅用于本地开发的 fallback 会加载 OpenStreetMap raster。正式商业上线前仍需按技术书选定合规 Tile Provider。


## v5 深度修正

- 修复 Travel Story 轮询时使用旧闭包，可能重置用户照片选择的问题。
- 东京官方探索会读取当前旅行已有官方地点，刷新后仍正确显示“已加入”。
- 首页不再写死 2026 年 10 月日历，改为跟随当前旅行月份，并标记旅行日期与今天。
- 当前旅行优先选择未归档旅行，避免侧栏和工作台自动指向已归档数据。
- 顶部搜索从静态占位改为可用的 Ctrl/Cmd + K 功能搜索。
- Access Token 与 Refresh Token 均失效时统一清理会话并跳转登录页。
- 旅行工作台与个人设置增加未登录保护。
- 创建旅行改为动态默认日期，并增加结束日期、同行人数和必填字段校验。
- MapLibre 修复首次加载路线数据的竞态；直接手动打卡且无 Place 的坐标也会显示 Marker。
- MapLibre 增加窗口 resize 处理与更贴合暖色主题的开发底图样式。
- 手动经纬度增加合法范围校验，避免 NaN/null 请求。
- 照片上传增加图片类型和 20MB 大小的前端预校验。
- Trip Pro 页面没有 recent trip id 时会从旅行列表自动恢复当前旅行。
- 登录支持 `?next=` 安全回跳。
- API Client 状态化联调回归：15 / 15 业务组通过。

### 本次检查结果

- TS / TSX 文件解析：31 个，语法错误 0。
- 项目内部 import 缺失：0。
- API Client 状态化 HTTP 联调：15 / 15 通过。
- 当前执行环境无法在线完成 `npm install`，因此未声称 `next build` 已通过；请本地安装依赖后执行 `npm run typecheck && npm run build`。

## v6 Integrated 联调修正

- 私有旅行页增加 Session Layout Guard，避免未登录首屏抢跑 API。
- API 网络不可达时返回明确的 `NETWORK_ERROR`。
- 退出登录无论后端是否可达都会清理前端状态并离开私有页面。
- 与 Backend v6 的 52 个前端 API 调用契约已做静态对应检查。
