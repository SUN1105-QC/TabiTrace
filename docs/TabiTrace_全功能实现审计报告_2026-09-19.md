# 《TabiTrace 全功能实现审计报告》

审计日期：2026-09-19
审计基线：`frontend/`（v0.6.0，Next.js 16.3.3）、`backend/`（Spring Boot 4.1.1 / Java 21）、Flyway V1+V2、MySQL 8.0.46（本机）
需求依据：`docs/旅迹_TabiTrace_MVP计划书_v3.0.md`、`docs/旅迹_TabiTrace_项目技术书_v3.0.md`、`docs/TabiTrace_数据库设计书_v1.0.md`、`docs/旅迹_TabiTrace_旅行视频输出功能计划_v1.0.md`
审计方式：需求文档提取 → 全量源码追踪 → 真实构建/打包 → 真实启动（API + Web + MySQL + Video Worker）→ 188 项 API E2E → 浏览器端 UI 与响应式实测 → 越权与异常流程验证
本轮约束：**只检查、不修改业务代码**。唯一改动：`.claude/launch.json` 端口配置（开发工具文件，从上轮临时的 3100 改回文档默认 3000）。

状态口径：**完整 / 部分 / 未实现 / 缺陷 / 无法验证**。"无法验证"不计入完成。

---

## 1. 项目总体状态

### 1.1 量化结论

| 指标 | 数值 | 口径 |
|---|---:|---|
| 功能检查项 | 137 | 见第 2 节矩阵，逐项对应代码位置与实测证据 |
| 完整 | 96（70.1%） | 前端 + 后端 + 数据 + 实测链路均成立 |
| 部分 | 20（14.6%） | 有实现但某一层缺失（多为后端有 API、前端无入口） |
| 未实现 | 10（7.3%） | 需求存在但代码中找不到实现 |
| 缺陷 | 7（5.1%） | 已实现但行为错误，含 1 项 P0 |
| 无法验证 | 4（2.9%） | 依赖外部凭据或沙箱受限网络 |

分层完成度（口径：矩阵中该层标记为"有职责"的项里，该层为 ✅ 的比例；数值由脚本直接从第 2 节表格统计得出）：

| 层 | 完成度 | 说明 |
|---|---:|---|
| 后端 API | **85.7%**（102/119） | 58 个接口全部可用；缺口是坐标校验、视频时长、5xx 兜底、密码/头像接口 |
| 前端 | **70.8%**（85/120） | 缺口集中在"后端有 API、前端无入口"（6 项）与成果差异化（水印/清晰度） |
| 数据库 | **98.0%**（98/100） | 15 张表、外键、索引、唯一约束与设计书 v1.0 逐项一致；扣分项为坐标列无法兜住越界值、photos 无 caption |
| 前后端联调 | **70.8%**（97/137） | 核心链路打通；行程转打卡在 UI 断裂、地图在脏数据下崩溃 |

生产就绪度：**不给出百分比**，因为它取决于 4 个尚未成立的前提，任何一个不满足都不能上线——
① 两个 P0 未修；② Stripe 真实支付未验证；③ R2 对象存储未接真实账号；④ FREE/PRO 成果差异化（水印、清晰度）未实现。

### 1.2 真实运行验证结果

| 项目 | 结果 | 证据 |
|---|---|---|
| `npm install` | PASS | exit 0，137 packages |
| `npm run typecheck` | PASS | tsc --noEmit 无错误 |
| `npm run build` | PASS | 19 条路由产出，编译 82s |
| `npm run dev` | PASS | http://localhost:3000 返回 200 |
| `mvn clean test` | PASS | 14 tests，0 failure / 0 error |
| `mvn package` | PASS | api 52MB JAR + video-worker 26MB JAR |
| Spring Boot 启动 | PASS | `/actuator/health` = UP |
| MySQL + Flyway | PASS | schema version 2，15 张表 |
| Video Worker + FFmpeg | PASS | 实测产出真实 MP4（详见 4.3） |
| API E2E（188 项） | 184 PASS / 4 FAIL | 2 项为脚本断言问题，2 项为真实缺陷 |
| 浏览器 UI 联调 | 部分 | 地图页在特定数据下整页崩溃（P0） |

---

## 2. 功能实现矩阵（137 项）

图例：✅ 完整 ⚠ 部分 ✖ 缺失/错误 — 无该层职责

| # | 模块 | 功能 | 前端 | 后端 | 库 | 联调 | 状态 | 说明 / 证据 |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| A1 | 用户 | 注册 | ✅ | ✅ | ✅ | ✅ | 完整 | 重复邮箱 EMAIL_EXISTS、弱密码/非法邮箱 VALIDATION_ERROR 均实测 |
| A2 | 用户 | 登录 | ✅ | ✅ | ✅ | ✅ | 完整 | 邮箱大小写不敏感；错误密码 401 |
| A3 | 用户 | 退出登录 | ✅ | ✅ | ✅ | ✅ | 完整 | `/profile` 退出按钮 + refresh token 吊销实测 |
| A4 | 用户 | Access Token | ✅ | ✅ | — | ✅ | 完整 | 15 分钟 TTL，伪造 token 401 |
| A5 | 用户 | Refresh Token 轮换/吊销 | ✅ | ✅ | ✅ | ✅ | 完整 | 旧 token 复用 REFRESH_TOKEN_REVOKED |
| A6 | 用户 | 401 自动刷新重试 | ✅ | ✅ | — | ✅ | 完整 | 浏览器实测：破坏 access token 后页面自动 refresh 并正常渲染 |
| A7 | 用户 | 双 token 失效统一跳登录 | ✅ | ✅ | — | ✅ | 完整 | `services/api.ts` 401 分支 → `/login?next=` |
| A8 | 用户 | 未登录访问保护页 | ✅ | — | — | ✅ | 完整 | `/trips/11/summary` → `/login?next=%2Ftrips%2F11%2Fsummary` |
| A9 | 用户 | 登录后回原页面 | ✅ | — | — | ✅ | 完整 | 实测登录后回到 `/trips/11/summary` |
| A10 | 用户 | 资料读取/修改 | ✅ | ✅ | ✅ | ✅ | 完整 | 昵称/语言/时区/可见性/通知，非法可见性被拒 |
| A11 | 用户 | 头像 | ✖ | ⚠ | ✅ | ✖ | 未实现 | `users.avatar_url` 与 DTO 存在，`app/profile/page.tsx` 无任何上传或编辑入口 |
| A12 | 用户 | 修改密码 | ✖ | ✖ | — | ✖ | 未实现 | 无接口、无页面 |
| A13 | 用户 | BCrypt 密码存储 | — | ✅ | ✅ | ✅ | 完整 | `SecurityConfig.passwordEncoder` |
| B1 | 旅行 | 旅行列表 | ✅ | ✅ | ✅ | ✅ | 完整 | 工作台聚合各旅行 summary |
| B2 | 旅行 | 创建旅行 | ✅ | ✅ | ✅ | ✅ | 完整 | 含官方探索自动关联 30 地点 |
| B3 | 旅行 | 编辑旅行 | ✖ | ✅ | ✅ | ⚠ | 部分 | `PUT /trips/{id}` 实测可用；前端无任何编辑入口 |
| B4 | 旅行 | 删除旅行 | ✖ | ✅ | ✅ | ⚠ | 部分 | `DELETE /trips/{id}` 实测可用；前端无删除按钮 |
| B5 | 旅行 | 旅行详情 | ✅ | ✅ | ✅ | ✅ | 完整 | `/trips/[id]` |
| B6 | 旅行 | 旅行封面 | ⚠ | ✅ | ✅ | ⚠ | 部分 | 后端支持 coverImage；前端固定写死 `/images/cover.jpg`，无选择/上传 |
| B7 | 旅行 | 状态流转 | ✅ | ✅ | ✅ | ✅ | 完整 | PLANNING→ONGOING（首次打卡）→COMPLETED |
| B8 | 旅行 | 完成旅行 | ✅ | ✅ | ✅ | ✅ | 完整 | 触发 TRIP_COMPLETE 成就 |
| B9 | 旅行 | 归档 / 取消归档 | ✅ | ✅ | ✅ | ✅ | 完整 | 归档只读、释放 FREE 名额、PRO 可恢复，全部实测 |
| B10 | 旅行 | FREE/PRO 按旅行生效 | ✅ | ✅ | ✅ | ✅ | 完整 | 打卡/照片/视频三处配额实测 |
| B11 | 旅行 | tripId 贯穿子页面 | ✅ | — | — | ✅ | 完整 | 子导航 7 个入口均带 tripId |
| B12 | 旅行 | `/trips/{id}/places` 路由 | ✖ | ✅ | ✅ | ✖ | 缺陷 | 实测 404（Next 默认 404 页）；需求清单要求该路由不 404 |
| C1 | 官方城市 | 城市列表 | ⚠ | ✅ | ✅ | ✅ | 完整 | 后端仅返回 ACTIVE；前端只用东京入口 |
| C2 | 官方城市 | 官方地点列表 | ✅ | ✅ | ✅ | ✅ | 完整 | 30 个地点，前端 30 张卡片全部渲染 |
| C3 | 官方城市 | 地点详情 | ⚠ | ✅ | ✅ | ⚠ | 部分 | `GET /places/{id}` 无前端调用；仅地图弹窗展示简要信息 |
| C4 | 官方城市 | 地点搜索 | ✅ | ⚠ | ✅ | ✅ | 部分 | 仅搜索库内 OFFICIAL 地点；MVP 要求的"全球任意地点"缺 Geocoding 供应商 |
| C5 | 官方城市 | 分类筛选 | ⚠ | ✅ | ✅ | ⚠ | 部分 | 前端仅按 area 过滤，category 字段未用于筛选 |
| C6 | 官方城市 | 加入旅行（幂等） | ✅ | ✅ | ✅ | ✅ | 完整 | 重复加入不产生重复记录（uk_trip_place + INSERT IGNORE） |
| C7 | 官方城市 | 官方/自定义区分 | ✅ | ✅ | ✅ | ✅ | 完整 | source_type 驱动地图颜色与权限 |
| D1 | 自定义地点 | 新增 | ✅ | ✅ | ✅ | ✅ | 完整 | 名称为空被拒 |
| D2 | 自定义地点 | 经纬度范围校验 | ⚠ | ✖ | ⚠ | ✖ | 缺陷 | **后端接受 lat=999/lng=999 并落库**；前端仅本页表单校验，API 无 @Min/@Max，DECIMAL(10,7) 未拦截 |
| D3 | 自定义地点 | 从旅行移除 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| D4 | 自定义地点 | 跨旅行权限 | — | ✅ | ✅ | ✅ | 完整 | 用户 B 引用 A 的 CUSTOM 地点被 403 |
| D5 | 自定义地点 | 地图展示 | ✅ | ✅ | ✅ | ✅ | 完整 | 虚线描边 marker |
| E1 | 行程 | 新增行程 | ✅ | ✅ | ✅ | ✅ | 完整 | 日期越界、无地点均被拒 |
| E2 | 行程 | 编辑行程 | ✖ | ✅ | ✅ | ⚠ | 部分 | `PUT /trips/{id}/itinerary/{itemId}` 实测可用；前端只有删除按钮 |
| E3 | 行程 | 删除行程 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| E4 | 行程 | 日期/时间/备注/坐标 | ✅ | ✅ | ✅ | ✅ | 完整 | Emoji 与日文正常落库 |
| E5 | 行程 | 计划状态 | ✅ | ✅ | ✅ | ✅ | 完整 | PLANNED/DONE/CANCELLED |
| F1 | 打卡 | 官方地点打卡 | ✅ | ✅ | ✅ | ✅ | 完整 | 名称/区域/坐标快照正确 |
| F2 | 打卡 | 计划转打卡 | ✖ | ✅ | ✅ | ✖ | **缺陷（P0）** | UI 点"到达打卡"必定 400，详见 3.1 |
| F3 | 打卡 | 直接打卡 / 补录 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| F4 | 打卡 | 修改打卡 | ✖ | ✅ | ✅ | ⚠ | 部分 | `PUT /checkins/{id}` 实测可用；前端只能删除 |
| F5 | 打卡 | 删除 / 撤销打卡 | ✅ | ✅ | ✅ | ✅ | 完整 | 关联行程回退为 PLANNED |
| F6 | 打卡 | 跨旅行行程/地点防护 | — | ✅ | ✅ | ✅ | 完整 | 跨旅行 itineraryItemId → 404；跨旅行 CUSTOM 地点 → 403 |
| F7 | 打卡 | 重复打卡处理 | ✅ | ✅ | ✅ | ✅ | 完整 | 同行程重复 → ITINERARY_ALREADY_CHECKED_IN |
| F8 | 打卡 | 删除后统计回算 | ✅ | ✅ | ✅ | ✅ | 完整 | 成就与 summary 重新计算 |
| G1 | 地图 | MapLibre 初始化 | ✅ | — | — | ✅ | 完整 | canvas 581×520，NavigationControl 就位 |
| G2 | 地图 | 底图瓦片 | ⚠ | — | — | ⚠ | 无法验证 | 代码含 OSM raster fallback；本审计沙箱无法访问 tile.openstreetmap.org，实测无瓦片渲染 |
| G3 | 地图 | Marker（官方/自定义/手动） | ✅ | ✅ | ✅ | ✅ | 完整 | 实测 31 个 marker |
| G4 | 地图 | 已/未打卡状态 | ✅ | ✅ | ✅ | ✅ | 完整 | 颜色区分 |
| G5 | 地图 | 路线按真实打卡时间 | ✅ | ✅ | ✅ | ✅ | 完整 | `[...checkins].sort(by checkinTime)`，非 places 顺序 |
| G6 | 地图 | 无坐标地点过滤 | ✅ | — | — | ✅ | 完整 | `valid()` 过滤 |
| G7 | 地图 | 越界坐标健壮性 | ✖ | ✖ | — | ✖ | **缺陷（P0）** | 一条越界坐标导致整页 Runtime Error 白屏，详见 3.2 |
| H1 | 时间轴 | 按日期分组 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| H2 | 时间轴 | 打卡/照片/备注聚合 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| H3 | 时间轴 | 增删后即时更新 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| H4 | 时间轴 | 时区换算 | ✅ | ✅ | ✅ | ✅ | 完整 | 同一打卡在 Asia/Tokyo 归 10-03、UTC 归 10-02，实测 |
| I1 | 照片 | 预签名授权 | ✅ | ✅ | — | ✅ | 完整 | 带 HMAC 签名与 15 分钟有效期 |
| I2 | 照片 | 二进制 PUT 上传 | ✅ | ✅ | — | ✅ | 完整 | 未签名/篡改签名均 403 |
| I3 | 照片 | 登记元数据 | ✅ | ✅ | ✅ | ✅ | 完整 | 未上传即登记被拒 |
| I4 | 照片 | URL 由服务端生成 | ✅ | ✅ | ✅ | ✅ | 完整 | 前端不能传入任意 URL |
| I5 | 照片 | 类型/大小校验 | ✅ | ✅ | — | ✅ | 完整 | 非图片 MIME、>20MB 均被拒（前后端双端） |
| I6 | 照片 | storageKey 越权防护 | — | ✅ | ✅ | ✅ | 完整 | 他人路径 INVALID_STORAGE_KEY |
| I7 | 照片 | 精选 / 取消精选 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| I8 | 照片 | 删除照片 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| I9 | 照片 | 批量上传 | ✖ | ⚠ | — | ✖ | 未实现 | 单文件 input，无多选与队列 |
| I10 | 照片 | 标题 / 说明 | ✖ | ✖ | ✖ | ✖ | 未实现 | photos 表无 caption 字段；`TimelinePhoto.caption` 恒为 null |
| J1 | 相册 | Grid 展示 | ✅ | ✅ | ✅ | ✅ | 完整 | 11 张实测全部加载 |
| J2 | 相册 | 空状态 | ✅ | — | — | ✅ | 完整 | |
| J3 | 相册 | Loading / 失败态 | ⚠ | — | — | ⚠ | 部分 | 有错误条，无加载骨架；上传失败仅文字提示 |
| J4 | 相册 | 按日期分组 | ✖ | ⚠ | ✅ | ✖ | 未实现 | 需求要求"按日期"，实现为单一 grid |
| K1 | 统计 | 打卡/地点/照片/天数 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| K2 | 统计 | 官方地点完成度 | ✅ | ✅ | ✅ | ✅ | 完整 | 8/30 → 27% 实测 |
| K3 | 统计 | 同一地点不重复计数 | — | ✅ | ✅ | ✅ | 完整 | 重复打卡后 places 数不变，实测 |
| K4 | 统计 | 区域 / 城市统计 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| L1 | 成就 | 成就定义 | ✅ | ✅ | ✅ | ✅ | 完整 | 9 条（5 GLOBAL + 4 TOKYO） |
| L2 | 成就 | 解锁条件计算 | — | ✅ | ✅ | ✅ | 完整 | 非 Mock：打卡/照片/区域/官方数驱动 |
| L3 | 成就 | 展示与进度 | ✅ | ✅ | ✅ | ✅ | 完整 | 未解锁显示真实百分比（60%/45%） |
| L4 | 成就 | 筛选 | ✖ | — | — | ✖ | 未实现 | 无已获得/未获得筛选 |
| M1 | 总结 | Summary 真实数据 | ✅ | ✅ | ✅ | ✅ | 完整 | 非硬编码 |
| M2 | 总结 | 每日记录 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| M3 | 总结 | 成果准备度 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| N1 | 分享 | PRIVATE / UNLISTED | ✅ | ✅ | ✅ | ✅ | 完整 | 创建链接后旅行转 UNLISTED |
| N2 | 分享 | 创建链接 | ✅ | ✅ | ✅ | ✅ | 完整 | SecureRandom 24 字节 token |
| N3 | 分享 | 匿名访问分享页 | ✅ | ✅ | ✅ | ✅ | 完整 | `/s/{token}` 无需登录 |
| N4 | 分享 | 撤销 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| N5 | 分享 | 撤销后旧链接失效 | ✅ | ✅ | ✅ | ✅ | 完整 | 立即 404，且旅行恢复 PRIVATE |
| N6 | 分享 | 失效时间 | ✖ | ✅ | ✅ | ⚠ | 部分 | 后端 expiresAt 生效（过期链接 404 实测）；前端无设置入口，且把已过期链接仍显示为"有效" |
| N7 | 分享 | 重新生成 | ✅ | ✅ | ✅ | ✅ | 完整 | 新旧 token 不同 |
| N8 | 分享 | 分享历史 | ⚠ | ✅ | ✅ | ⚠ | 部分 | UI 只列 ACTIVE，已撤销记录不可见 |
| O1 | 成果图 | 城市海报 | ✅ | ✅ | ✅ | ✅ | 完整 | 真实 summary + 照片渲染 |
| O2 | 成果图 | 九宫格 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| O3 | 成果图 | 每日长图 | ✅ | ✅ | ✅ | ✅ | 完整 | 按 timeline 逐日铺排 |
| O4 | 成果图 | PNG 导出 | ⚠ | — | — | ⚠ | 部分 | `html-to-image` toPng + a.download 代码完整；本轮未实际触发文件下载 |
| O5 | 成果图 | FREE 水印 | ✖ | ✖ | — | ✖ | 未实现 | 分享图三种模板均无水印逻辑 |
| O6 | 成果图 | PRO 高清 / 去水印 | ✖ | ✖ | — | ✖ | 未实现 | pixelRatio 固定 2，与 planType 无关 |
| O7 | 成果图 | 移动端导出 | ⚠ | — | — | ⚠ | 无法验证 | 需真机验证 html-to-image 在移动浏览器行为 |
| P1 | 视频 | 项目创建 | ✅ | ✅ | ✅ | ✅ | 完整 | |
| P2 | 视频 | 草稿编辑 | ✖ | ✅ | ✅ | ⚠ | 部分 | `PUT /video-projects/{id}` 实测可用；前端只能新建 |
| P3 | 视频 | 照片选择（轮询不覆盖） | ✅ | ✅ | ✅ | ✅ | 完整 | `selectionInitialized` ref 防覆盖，FIX_REPORT 声明属实 |
| P4 | 视频 | 三套模板 | ✅ | ✅ | ✅ | ✅ | 完整 | JOURNAL / MINIMAL / CITY |
| P5 | 视频 | 音乐 | ⚠ | ⚠ | ✅ | ⚠ | 部分 | 白名单校验有效；项目不含任何 BGM 文件，非 NONE 选项未验证 |
| P6 | 视频 | 文字/地图/成就开关 | ✅ | ⚠ | ✅ | ⚠ | 部分 | 参数正确存取；FFmpeg 渲染器只做照片拼接，三个开关不影响成片 |
| P7 | 视频 | 状态流转 | ✅ | ✅ | ✅ | ✅ | 完整 | DRAFT→QUEUED→PROCESSING→COMPLETED 实测 |
| P8 | 视频 | 删除项目 | ✖ | ✅ | ✅ | ⚠ | 部分 | 前端无删除入口 |
| P9 | 视频 | 历史项目列表 | ✖ | ✅ | ✅ | ✖ | 未实现 | UI 只显示 projects[0]，已完成的旧视频无法访问 |
| P10 | 视频 | 失败重试 | ✖ | ✅ | ✅ | ⚠ | 部分 | 后端允许 FAILED→render；UI 无重试按钮，也不显示 errorMessage |
| P11 | 视频 | FREE/PRO 限制双端 | ✅ | ✅ | ✅ | ✅ | 完整 | 前端拦截 + 后端 PRO_TEMPLATE_REQUIRED / VIDEO_PHOTO_LIMIT |
| P12 | 视频 | 真实 FFmpeg 渲染 | — | ✅ | ✅ | ✅ | 完整 | 实测产出 MP4：PRO 1080×1920 无水印、FREE 720×1280 带水印 |
| P13 | 视频 | 成片时长正确性 | — | ✖ | — | ✖ | 缺陷 | FREE 2 张照片成片仅 15.03s（应 30s）；4 张照片时为 30s |
| P14 | 视频 | Mock 与真实 Worker 切换 | — | ✖ | — | ✖ | 缺陷 | `VIDEO_MOCK_RENDERER=false` 在 local profile 下被 `application-local.yml` 覆盖，环境变量无效 |
| Q1 | 支付 | Checkout 创建 | ✅ | ✅ | ✅ | ✅ | 完整 | Mock 模式直接 PAID 并升级 |
| Q2 | 支付 | Stripe 真实链路 | — | ⚠ | ✅ | ⚠ | 无法验证 | 需 Stripe 测试密钥；代码为直连 REST，未执行 |
| Q3 | 支付 | Webhook 签名校验 | — | ✅ | ✅ | ✅ | 完整 | 伪造签名被拒且旅行保持 FREE，实测 |
| Q4 | 支付 | payment_status 未支付不升级 | — | ⚠ | ✅ | ⚠ | 无法验证 | 代码分支存在（`PaymentService.webhook`）；Mock 模式无法造出 PENDING 支付，未执行该分支 |
| Q5 | 支付 | 支付记录 | ✅ | ✅ | ✅ | ✅ | 完整 | 490 JPY / MOCK / PAID |
| Q6 | 支付 | PRO 权限变化 | ✅ | ✅ | ✅ | ✅ | 完整 | 升级后第 11 个打卡、第 11 张照片、CITY 模板全部放行 |
| R1 | 响应式 | PC（≥1024） | ✅ | — | — | ✅ | 完整 | 左侧栏 + 顶部工作区 + 右侧信息栏 |
| R2 | 响应式 | 平板（768） | ⚠ | — | — | ⚠ | 部分 | 768 仍走移动布局：侧栏与顶栏隐藏，仅底部导航 |
| R3 | 响应式 | 移动（375） | ✅ | — | — | ✅ | 完整 | 底部 5 项导航，地图 335px 自适应 |
| R4 | 响应式 | 无横向滚动 | ✅ | — | — | ✅ | 完整 | 375/768 实测 scrollWidth = viewport |
| S1 | 状态 | 401 / 403 / 404 | ✅ | ✅ | — | ✅ | 完整 | 前端显示后端中文消息 |
| S2 | 状态 | 400 / 405 / 415 | ✅ | ✅ | — | ✅ | 完整 | 六类客户端错误全部返回正确码 |
| S3 | 状态 | 5xx 兜底 | — | ✖ | — | ✖ | 缺陷 | 非法坐标触发 DataIntegrityViolationException → 500 INTERNAL_ERROR |
| S4 | 状态 | Loading | ⚠ | — | — | ⚠ | 部分 | `/trips`、`/explore/tokyo` 有；map/gallery/video/share 无 |
| S5 | 状态 | Empty | ⚠ | — | — | ⚠ | 部分 | trips/gallery/itinerary/timeline 有；成就、分享历史无 |
| S6 | 状态 | Retry | ✖ | — | — | ✖ | 未实现 | 所有页面失败后只能手动刷新 |
| T1 | 安全 | IDOR / 跨用户隔离 | — | ✅ | ✅ | ✅ | 完整 | 11 组越权用例（旅行/打卡/照片/行程/视频/分享/支付）全部 403 |
| T2 | 安全 | Share token | — | ✅ | ✅ | ✅ | 完整 | 不可预测 + 撤销/过期即时失效 |
| T3 | 安全 | 上传签名 | ✅ | ✅ | — | ✅ | 完整 | 未签名/篡改 403 |
| T4 | 安全 | 恶意 MIME / 任意 URL | ✅ | ✅ | ✅ | ✅ | 完整 | |
| T5 | 安全 | 生产密钥校验 | — | ✅ | — | ✅ | 完整 | prod profile 下弱 JWT_SECRET 启动即失败（单测覆盖） |
| T6 | 安全 | CORS / CSRF / 无状态会话 | — | ✅ | — | ✅ | 完整 | 白名单 Origin，STATELESS，CSRF 关闭符合纯 API 场景 |

---

## 3. P0 问题（阻断核心功能）

### 3.1 计划行程转打卡在 UI 中 100% 失败

- **位置**：`frontend/app/trips/[id]/map/page.tsx:12`（`offsetIso`）与同文件 `completePlan`
- **原因**：后端 `ItineraryView.plannedTime` 序列化为 `HH:mm:ss`（`19:30:00`），前端 `offsetIso(date,time)` 仍按 `HH:mm` 拼接，生成 `2026-10-01T19:30:00:00+09:00`
- **实测**：浏览器点击"到达打卡" → `POST /trips/11/itinerary/8/checkin` 返回 **400 INVALID_REQUEST_BODY**，页面提示"请求体格式不正确"；API E2E 同样复现
- **影响**：MVP 核心旅程"添加计划行程 → 到达打卡"在界面上完全不可用（只有未设时间的行程可走 12:00 兜底）
- **注**：该缺陷在 2026-09-17 会话中曾修复（`time.slice(0,5)`），在本轮前端重构后**回归**
- **修复建议**：`offsetIso` 内统一 `time.slice(0,5)`；同时在 `ItineraryView` 或前端显示层统一时间格式，并补一条回归用例

### 3.2 一条越界坐标导致旅行地图页整页崩溃

- **位置**：`backend/.../place/dto/PlaceDtos.java`（无范围校验）+ `frontend/components/map/LiveTravelMap.tsx:48`
- **链路**：`POST /trips/{id}/places/custom` 接受 `latitude=999, longitude=999` 并落库 → 地图页 `new maplibregl.Marker().setLngLat([999,999])` 抛 `Invalid LngLat latitude value` → React 未捕获 → 整页 Runtime Error 白屏
- **实测**：写入一条越界地点后 `/trips/11/map` 直接报错白屏；删除该记录后页面恢复（31 marker 正常）
- **影响**：任何用户（包括误操作或恶意请求）可使自己的地图页永久不可用；打卡接口同样接受 `lat=999/lng=-999`
- **修复建议**：① DTO 增加 `@DecimalMin/@DecimalMax`（lat ±90、lng ±180），覆盖自定义地点、打卡、行程三个入口；② `LiveTravelMap.valid()` 增加范围判断；③ 地图组件加错误边界

---

## 4. P1 问题（MVP 发布前应解决）

### 4.1 非法数值触发 500

非法坐标（`latitude=12345`）在行程接口触发 `MysqlDataTruncation → DataIntegrityViolationException`，被兜底为 **500 INTERNAL_ERROR** 并打印完整堆栈。应在 `GlobalExceptionHandler` 中将 `DataIntegrityViolationException` 映射为 400，并在 DTO 层前置校验。

### 4.2 后端已实现、前端无入口（6 项）

`PUT /trips/{id}`（编辑旅行）、`DELETE /trips/{id}`（删除旅行）、`PUT /trips/{id}/itinerary/{itemId}`（编辑行程）、`PUT /checkins/{id}`（修改打卡）、`PUT /video-projects/{id}`（编辑草稿）、`DELETE /video-projects/{id}`。这 6 个接口本轮均实测可用，但界面上没有任何触发点，等于"功能存在但用户用不到"。

### 4.3 视频链路

| 子项 | 结论 |
|---|---|
| 真实 FFmpeg 渲染 | **可用**：PRO 1080×1920 / FREE 720×1280 + 水印，30s h264，产物写入 `frontend/public/generated-videos/project-N/output.mp4`，前端 200 可播 |
| Mock 开关 | **缺陷**：`application-local.yml` 硬编码 `mock-renderer-enabled: true`，README 教的 `VIDEO_MOCK_RENDERER=false` 无效，必须用 `--app.video.mock-renderer-enabled=false`；否则 Mock 渲染器抢走任务并写入 `https://example.invalid/videos/N.mp4` |
| 成片时长 | **缺陷**：2 张照片的成片只有 15.03s（应 30s），`FfmpegRenderer` concat 最后一段时长未生效 |
| 历史项目 | UI 仅显示最新一个项目，已完成的视频无法再次获取 |
| 产物落地 | Worker 默认把 MP4 写进 `frontend/public/`（未被 .gitignore 覆盖），会污染前端仓库 |

### 4.4 本地存储目录依赖进程工作目录

`LOCAL_STORAGE_DIR` 默认相对路径 `./.tabitrace/uploads`。用 `mvn -pl api spring-boot:run`（cwd=`backend/api`）与用 `java -jar`（cwd=`backend`）启动会指向**不同目录**，导致历史照片全部 404（本轮实测 `LOCAL_FILE_NOT_FOUND`）。建议改为绝对路径或基于固定根目录解析。

### 4.5 `/trips/{id}/places` 路由 404

需求清单要求该路由可用；当前 `app/trips/[id]/` 下只有 `gallery` 与旧 `photos`（redirect），`places` 目录不存在。

---

## 5. P2 问题（体验与工程质量）

1. 分享页把已过期链接仍显示为"有效"（只按 `status==='ACTIVE'` 过滤，未判断 `expiresAt`）。
2. 平板（768）没有独立布局，直接套用移动端。
3. 缺少 Loading 骨架与 Retry：map/gallery/video/share 页失败后只能手动刷新。
4. 公开分享页不展示精选照片（后端已返回 `featuredPhotos`，前端未渲染）。
5. 相册无按日期分组、无批量上传、无标题/说明（`photos` 表无 caption 字段）。
6. 成就页无筛选；视频页不显示 `errorMessage`。
7. `frontend/public/generated-videos` 未加入 `.gitignore`。
8. 种子数据文案"9 个探索区域"与实际 10 个区域不符。
9. 数据库设计书的 `trips.status` 枚举仍未包含 `ARCHIVED`（代码与迁移已在用）。

---

## 6. 未实现功能清单

| 功能 | 需求出处 | 目前缺什么 | 建议落点 |
|---|---|---|---|
| 修改密码 | MVP 账号与个人资料 | 无接口、无页面 | 新增 `PUT /users/me/password` + `UserService`；前端 `/profile` 增区块 |
| 头像 | MVP 账号与个人资料 | 仅有 DB 字段 | 复用照片预签名通道；`/profile` 增上传 |
| 照片标题/说明 | MVP 旅行照片 | photos 表无 caption | 需 V3 迁移增列 + DTO/编辑 UI |
| 照片按日期分组、批量上传 | MVP 旅行照片 | 前端 | `gallery/page.tsx` |
| FREE 水印 / PRO 高清 | MVP 商业模式与成果 | 分享图无差异化 | 三个模板加水印层，导出按 planType 调 pixelRatio |
| 视频历史项目列表 | 视频计划 v1.0 §20 | 前端只显示 1 个 | `video/page.tsx` 增列表 |
| 成就筛选 | MVP 成就系统 | 前端 | `achievements/page.tsx` |
| 失败重试入口 | 视频计划 v1.0 §27 | 前端 | 展示 errorMessage + 重试按钮 |
| 全球地点搜索（Geocoding） | MVP 全球自由记录 | 未选供应商 | 后端 `/places/search` 接入外部 Provider |
| Retry / Loading 统一组件 | 技术书 §7 | 前端 | 公共组件 |

---

## 7. 前后端接口契约

| 指标 | 结果 |
|---|---|
| 后端接口总数 | 58 |
| 前端调用接口数 | 45 |
| 前端调用但后端缺失 | **0** |
| 路径 / 方法不匹配 | **0** |
| 响应字段不匹配 | **0**（188 项 E2E 中所有 DTO 字段均按前端类型解析成功） |
| 格式不一致 | **1**：`plannedTime` 后端 `HH:mm:ss` vs 前端按 `HH:mm` 拼接（P0，见 3.1） |
| 后端存在但前端未调用 | 2 项有效：`GET /places/{id}`、`GET /official-cities`（其余为 auth/local-storage/webhook，属正常） |

---

## 8. Mock 与真实实现边界

| 能力 | 当前状态 |
|---|---|
| 认证 / 旅行 / 地点 / 行程 / 打卡 / 时间轴 / 照片元数据 / 统计 / 成就 / 总结 / 分享 | **真实实现**（MySQL 持久化，重新登录后数据一致，实测） |
| 照片二进制存储 | 本地磁盘真实读写（`STORAGE_MODE=local`）；R2 为代码实现 + 单测，**未接真实云账号** |
| 支付 | **本地 Mock**：Checkout 立即 PAID；Stripe REST + Webhook HMAC 为真实代码，未连测试环境 |
| 视频渲染 | 两条路径：API 内置 **Mock 渲染器**（默认开启，输出 `example.invalid` 占位地址）与 **真实 FFmpeg Worker**（本轮实测可产出 MP4） |
| BGM 音乐 | 无任何音频文件，音乐选项仅落库 |
| 地图底图 | 代码接 OSM raster；本审计环境无法访问外网瓦片 |
| 分享图 | 真实 `html-to-image` 渲染真实数据（无水印/清晰度分级） |

未发现以下"假实现"：无 TODO/FIXME 残留、无硬编码旅行或地点数据、无 `Math.random` 造数据、无只读按钮、无空 Controller、无未使用的数据表（15 张表均有读写）。

---

## 9. 数据库核对

- 迁移：V1（15 张表 + 外键 + 索引 + 唯一约束）、V2（1 城市 / 30 地点 / 9 成就），Flyway 校验通过，`schema version = 2`。
- 与设计书 v1.0 逐表比对：表名、字段、类型、默认值、索引、外键删除策略**全部一致**。
- 设计书提到但当前不存在：`video_music`、`video_templates`（代码用白名单，设计书 §14 已注明为后续运营化项目）。
- 约束有效性实测：`uk_trip_place`（重复加入幂等）、`uk_user_trip_achievement`（成就不重复发放）、外键级联（删除旅行后打卡/照片/支付随之消失）。
- 风险：
  1. `places` 无 `owner_user_id`，CUSTOM 地点归属仅靠 `trip_places` + 服务层（删除旅行后会留下孤儿地点记录）。
  2. 坐标列 `DECIMAL(10,7)` 允许 ±999，无法在库层兜住越界值（见 P0-3.2）。
  3. `payments` 对 `trips` 使用 CASCADE，删除旅行会连带删除支付记录，正式运营前需评估财务留存。

---

## 10. 真实运行测试报告

### 前端
| 项 | 结果 |
|---|---|
| npm install | PASS |
| typecheck | PASS |
| build | PASS |
| dev（:3000） | PASS |

### 后端
| 项 | 结果 |
|---|---|
| mvn clean test（14） | PASS |
| mvn package | PASS |
| Spring Boot 启动 | PASS |
| MySQL 连接 | PASS |
| Flyway 迁移 | PASS |
| Video Worker + FFmpeg | PASS |

### 联调（浏览器 + API）
| 流程 | 结果 |
|---|---|
| 注册 / 登录 / 登出 / 自动刷新 / 回跳 | PASS |
| 创建旅行 / 编辑（仅 API） / 归档 / 取消归档 | PASS |
| 官方地点加入 / 自定义地点 | PASS |
| 添加行程 | PASS |
| **计划转打卡（UI）** | **FAIL**（400，见 3.1） |
| 直接打卡 / 补录 / 删除 | PASS |
| 照片上传 / 精选 / 删除 | PASS |
| 地图（标记 / 路线 / 时间序） | PASS |
| **地图（越界坐标）** | **FAIL**（整页崩溃，见 3.2） |
| 地图底图瓦片 | NOT VERIFIED |
| 时间轴 / 时区 | PASS |
| 统计 / 成就 / 总结 | PASS |
| 分享链接 / 匿名访问 / 撤销 | PASS |
| 分享图三模板渲染 | PASS |
| 分享图 PNG 下载 | NOT VERIFIED |
| Travel Story（Mock 渲染） | PASS |
| Travel Story（真实 FFmpeg） | PASS |
| Trip Pro（Mock 支付 → 权限变化） | PASS |
| Stripe 真实支付 | NOT VERIFIED |
| 越权 / IDOR（11 组） | PASS |
| 错误码契约（400/401/403/404/405/415） | PASS |
| 数据持久化（重新登录后一致） | PASS |
| 响应式 PC / Mobile | PASS |
| 响应式 Tablet | 部分（套用移动布局） |

---

## 11. 最终结论

**当前阶段判定：可完成本地 MVP 演示，尚未达到可进入测试环境的标准。**

依据：

1. **基础链路是真的**：58 个接口、15 张表、188 项 E2E 中 184 项通过，数据可持久化、可重新登录后读取，越权防护全部有效，不是原型或假数据。
2. **但核心旅程存在断点**：MVP 明确的"计划行程 → 到达打卡"在界面上 100% 失败（P0-3.1），一条越界坐标即可让旅行地图永久白屏（P0-3.2）。这两项在修复前不能对外开放测试。
3. **商业闭环仍是 Mock**：Trip Pro 支付、R2 存储、Stripe Webhook 均未接真实外部环境；付费转化这一 MVP 头号验证目标无法在当前配置下验证。
4. **成果差异化缺失**：FREE 水印 / PRO 去水印与高清导出是付费理由的一部分，目前完全没有实现。

建议顺序：先修 3.1、3.2 两个 P0 → 补齐 4.2 的 6 个前端入口与 4.1 的 500 兜底 → 打通 Stripe 测试模式与 R2 → 再补水印/清晰度分级与视频历史列表，然后可进入测试环境。

---

## 附录 A：本轮审计使用的验证资产

- API E2E 脚本：188 项断言，覆盖 A~T 全部模块与异常流程（会话临时目录，可按需固化到 `backend/scripts/`）
- 测试账号：`audit-a-*@example.test` / `audit-b-*@example.test`（数据库中留有测试数据，可用 `DELETE FROM users WHERE email LIKE 'audit-%@example.test'` 清理）
- 本轮唯一文件改动：`.claude/launch.json`（端口 3100 → 3000）；已删除测试产生的 `frontend/public/generated-videos/`
