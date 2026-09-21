# 《TabiTrace 全功能实现审计报告》

审计日期：2026-09-18  
审计范围：`frontend/`、`backend/`、Flyway 数据库迁移、正式需求文档及实现状态文档  
审计方式：静态代码追踪 + 前后端真实构建 + 本地 MySQL 启动验证 + 核心 API E2E + 权限越权检查  
本轮约束：仅检查、验证和记录，不修改业务代码。

状态只使用：**完整 / 部分 / 未实现 / 缺陷 / 无法验证**。

---

## 1. 项目总体实现概况

TabiTrace 已经不是纯页面原型：登录、旅行、地点、行程、打卡、照片、统计、成就、公开分享、Mock 支付和 Mock 视频任务均接入真实 API 与 MySQL；前后端均可构建并启动，核心数据写入后重新登录仍可读取。当前主要短板集中在产品闭环和生产能力，而不是基础 CRUD 骨架。

### 1.1 量化结论

| 指标 | 结果 | 口径 |
|---|---:|---|
| 功能检查项 | 92 | 见第 4 节逐项矩阵 |
| 完整 | 56（60.9%） | 前端、后端、数据及可运行链路均满足该项 |
| 部分 | 16（17.4%） | 有实现，但 UI、约束或生产闭环不完整 |
| 未实现 | 6（6.5%） | 需求存在，但未找到对应实现 |
| 缺陷 | 11（12.0%） | 已实现但行为与需求不符，或存在明确安全/一致性问题 |
| 无法验证 | 3（3.3%） | 依赖外部凭据、真实基础设施或设备矩阵 |
| 前端完成度 | 约 64% | 以有前端职责的矩阵项中“完整”为完成 |
| 后端完成度 | 约 75% | 以有后端职责的矩阵项中“完整”为完成 |
| 数据库完成度 | 约 90% | 核心表、约束、索引和迁移覆盖度 |
| 联调完成度 | 约 65% | 浏览器/API 到数据库的闭环覆盖度 |
| 生产就绪度 | 约 37% | 排除 Mock、外部链路未验、弱安全校验及缺失运维闭环 |

> 百分比用于排期判断，不代表测试覆盖率。只有矩阵中的“完整”计入完成；“部分”不折算为半分。

### 1.2 运行与构建结果

| 项目 | 结果 | 证据 |
|---|---|---|
| 前端类型检查 | 完整 | `npm run typecheck` 通过 |
| 前端生产构建 | 完整 | `npm run build` 通过 |
| 前端依赖审计 | 完整 | `npm audit`：0 vulnerability |
| 前端运行 | 完整 | `http://localhost:3000` 返回 200 |
| 后端单元测试 | 完整 | `mvn clean test`：14 tests，0 failure/error |
| 后端打包 | 完整 | `mvn package` 通过，API 与 video-worker 均产出 JAR |
| 后端运行 | 完整 | `http://localhost:8080/actuator/health` 返回 200/UP |
| Flyway | 完整 | V1、V2 校验并迁移成功，schema version 2 |
| MySQL | 部分 | 实测 8.0.46；项目基线文档写 8.4，当前可运行但版本不一致 |
| `/trips/{id}/places` | 缺陷 | 实测 `http://localhost:3000/trips/8/places` 返回 404 |

---

## 2. 已完整实现功能

以下能力具备真实代码和运行证据，不是静态假页面：

- 注册、登录、登出、Access/Refresh Token、Refresh Token 轮换与吊销、前端 401 自动刷新。
- Trip 创建、列表、详情、完成、归档/恢复，Free/Pro 状态落库。
- 官方城市/地点查询、自定义地点、地点与旅行关联、重复官方地点幂等处理。
- 行程新增/删除/状态、从行程转打卡；手工/补录打卡、删除和旅行统计回算。
- MapLibre 地图初始化、标记点、已去/未去状态、按打卡时间绘制路线、无坐标过滤。
- 照片预签名、上传、登记、列表、设封面；存储 key 与 URL 由服务端生成。
- 统计、成就规则计算及持久化、总结页 API。
- PRIVATE/UNLISTED、随机分享 Token、匿名公开访问、撤销和旧链接失效。
- 三类图片分享模板具备真实 DOM-to-PNG 生成与下载，不是“点击后无文件”。
- 视频项目建档、状态机、轮询、Free/Pro 数量限制和本地 Mock 完成链路。
- Mock 支付可真实写入支付记录并把指定 Trip 升级为 PRO。
- BCrypt 密码、JWT 签名、生产环境弱密钥拦截、Trip 所有权检查和跨用户 IDOR 拦截。

核心 E2E 中，用户 A 访问用户 B 的旅行返回 403；跨旅行写入行程返回 404；跨旅行引用自定义地点返回 403；公开链接可匿名读取，撤销后的旧 Token 返回 404。

---

## 3. 部分实现功能

- 用户资料可维护昵称、地区、时区、默认可见性和通知偏好，但无头像上传 UI；后端仅接受任意头像 URL。
- Trip 更新/删除、行程编辑、打卡编辑、照片更新、视频编辑/删除已有 API 客户端与后端接口，但当前页面没有完整操作入口。
- 官方地点搜索是本地数据库筛选，不是完整外部 POI 搜索；地点分类能力较轻。
- 时间轴聚合了打卡、照片和备注，但未纳入未完成/取消的 itinerary 项。
- 图库是网格与封面选择，缺少按日期分组、详情与元数据编辑。
- 图片分享可生成，但套餐差异、地图元素和水印策略不符合需求。
- 视频前端可选模板、音乐、开关和照片，但不能排序；历史、编辑、删除、失败重试未形成 UI 闭环。
- FFmpeg worker 能生成照片轮播、背景音乐和 Free 水印，但忽略模板、地图、旅行文字和成就开关，尚不是完整 Travel Story。
- Stripe checkout/webhook 代码结构存在，但本地未配置真实 Stripe，不能把静态实现等同于支付验收通过。
- 多数页面有 loading/error/empty 状态，但删除、撤销、地图和视频失败场景缺少一致的错误恢复与重试。

---

## 4. 未实现功能

### 4.1 全功能检查矩阵（92 项）

证据缩写：`F` 前端，`B` 后端/API，`DB` 数据层，`E2E` 真实运行链路。

| ID | 模块 | 功能 | 状态 | 实现证据与端到端结论 |
|---:|---|---|---|---|
| 1 | 用户 | 注册与登录 | 完整 | F 表单/API；B AuthController/AuthService；DB users/refresh_tokens；E2E 通过 |
| 2 | 用户 | 登出、刷新、自动续期 | 完整 | F `services/api.ts`；B refresh rotation/revoke；E2E 登出后重登通过 |
| 3 | 用户 | 资料与头像 | 部分 | F 可改偏好但无头像上传；B 支持 avatar URL；DB 有 avatar_url |
| 4 | 用户 | 路由保护与数据隔离 | 完整 | F auth guard；B ownership；E2E 跨用户 Trip=403 |
| 5 | Trip | 列表、创建、详情 | 完整 | F 页面；B TripController/Service；DB trips；E2E 通过 |
| 6 | Trip | 编辑与删除的产品入口 | 部分 | B 接口存在；F API 方法存在但详情页无完整入口 |
| 7 | Trip | 完成、归档、恢复 | 完整 | F 操作；B 状态更新；DB 持久化 |
| 8 | Trip | 详情子路由完整性 | 缺陷 | `/map` 等存在；需求点名的 `/trips/{id}/places` 实测 404 |
| 9 | 官方地点 | 城市、列表、详情 | 完整 | F/B/DB 官方城市地点完整 |
| 10 | 官方地点 | 搜索与分类 | 部分 | 有关键词/分类筛选；仅本地数据，分类体验有限 |
| 11 | 官方地点 | 添加到旅行 | 完整 | B trip_places；E2E 通过 |
| 12 | 官方地点 | 去重与复用 | 完整 | `INSERT IGNORE`；E2E 重复添加仍仅一条 |
| 13 | 自定义地点 | 新增与字段保存 | 完整 | F 表单；B PlaceService；DB places；E2E 通过 |
| 14 | 自定义地点 | 经纬度合法范围 | 缺陷 | B DTO 无 ±90/±180 约束；E2E 成功写入 91/181 |
| 15 | 自定义地点 | 移除后重加 | 缺陷 | remove 只删 trip_places；CUSTOM 孤儿记录无法按现有 API 重加 |
| 16 | 自定义地点 | 归属隔离与地图显示 | 完整 | B 校验归属；E2E 跨 Trip=403；F marker 显示 |
| 17 | 行程 | 新增与列表 | 完整 | F/B/DB/E2E 通过 |
| 18 | 行程 | 编辑入口 | 部分 | B PUT 与 F client 存在；页面未调用 `updateItinerary` |
| 19 | 行程 | 删除与状态 | 完整 | F/B/DB 闭环 |
| 20 | 行程 | 转为打卡 | 完整 | B 防重复并置 DONE；E2E 通过 |
| 21 | 打卡 | 地点/行程/手工补录 | 完整 | F 多入口；B create/fromItinerary；E2E 通过 |
| 22 | 打卡 | 编辑入口 | 部分 | B PUT 与 F client 存在；页面无编辑操作 |
| 23 | 打卡 | 删除与统计回算 | 完整 | F/B；成就重新评估；统计按当前记录查询 |
| 24 | 打卡 | 跨对象校验与行程防重复 | 完整 | B place/itinerary ownership；E2E 越权被拒 |
| 25 | 地图 | 初始化与底图 | 完整 | F MapLibre + OSM fallback；运行可加载 |
| 26 | 地图 | 多类标记与状态 | 完整 | 官方/自定义/手工打卡 marker；已去状态 |
| 27 | 地图 | 路线顺序 | 完整 | 按 checkinTime 排序绘线；无坐标点被过滤 |
| 28 | 地图 | 当前定位与加载失败恢复 | 缺陷 | 无 current-location；无 style/error 事件后的可恢复 UI |
| 29 | 时间轴 | 按日期分组排序 | 完整 | B UTC→用户时区；mapper 按时间排序；E2E 两日顺序正确 |
| 30 | 时间轴 | 打卡、照片、备注聚合 | 完整 | B TimelineItem；F 展示；E2E 通过 |
| 31 | 时间轴 | itinerary 全量聚合 | 未实现 | `CheckinService.timeline` 只遍历 checkins，未查询 itinerary |
| 32 | 时间轴 | 变更后刷新与时区 | 完整 | F reload；B ZoneId 转换 |
| 33 | 照片 | 预签名、上传、登记 | 完整 | F 三步上传；B storage；本地 E2E 上传成功 |
| 34 | 照片 | 列表与封面 | 完整 | F gallery；B list/feature；E2E 通过 |
| 35 | 照片 | 标题/说明/批量元数据 | 部分 | 仅 capturedAt/checkinId 等；无标题/说明字段与 UI |
| 36 | 照片 | 内容校验与存储清理 | 缺陷 | 信任 MIME/大小声明；未验文件魔数；删除只删 DB 不删对象 |
| 37 | 图库 | 网格与精选 | 完整 | F gallery grid/feature |
| 38 | 图库 | 日期分组、详情、编辑 | 未实现 | 未找到对应页面或交互 |
| 39 | 图库 | 空态与加载态 | 完整 | F 明确状态分支 |
| 40 | 图库 | 失败恢复与响应式体验 | 部分 | 有错误文本；缺少重试；小屏主要依赖通用 CSS |
| 41 | 统计 | 天数/地点/照片/区域 | 完整 | B SummaryService；E2E 3/2/1/2 |
| 42 | 统计 | 官方地点 distinct 计数 | 完整 | SQL distinct/summary 实现 |
| 43 | 统计 | 探索率与城市范围 | 完整 | B 真实计算，不是硬编码 |
| 44 | 统计 | 删除后的动态更新 | 完整 | 读取当前数据聚合，无静态缓存 |
| 45 | 成就 | 定义与规则 | 完整 | DB achievements；B evaluator |
| 46 | 成就 | 解锁与持久化 | 完整 | user_achievements；E2E 解锁 1 项 |
| 47 | 成就 | 展示与进度 | 完整 | F 页面；B progress/earned |
| 48 | 成就 | 分类筛选 | 未实现 | 前端仅平铺，无筛选 |
| 49 | 总结 | 真实 API 数据 | 完整 | F tripApi.summary；B SummaryService |
| 50 | 总结 | 日期/城市/数量 | 完整 | E2E 返回真实聚合 |
| 51 | 总结 | 照片与成就 | 完整 | F 展示；B 返回 |
| 52 | 总结 | readiness/完成态 | 完整 | B readiness；F 页面接入 |
| 53 | 链接分享 | PRIVATE→UNLISTED 与 Token | 完整 | B SecureRandom 24 bytes；DB share_links |
| 54 | 链接分享 | 匿名公开页 | 完整 | Security permitAll；E2E 未登录读取成功 |
| 55 | 链接分享 | 撤销、重建、旧链接失效 | 完整 | E2E revoke 后旧 Token=404 |
| 56 | 链接分享 | 过期状态与可见性回收 | 缺陷 | 可创建过去时间；过期不落 EXPIRED，也不会自动恢复 PRIVATE |
| 57 | 图片分享 | 三种模板 | 完整 | poster/nine/long 均有真实组件 |
| 58 | 图片分享 | PNG 生成与下载 | 完整 | `html-to-image.toPng` + download，不是占位按钮 |
| 59 | 图片分享 | 地图及完整数据合成 | 部分 | 照片/统计/日期存在；城市海报缺少地图 |
| 60 | 图片分享 | Free/Pro 水印与清晰度 | 缺陷 | 全部固定 pixelRatio=2、模板不设门槛且品牌字样始终存在 |
| 61 | 视频 | 建档与配置 | 完整 | F create；B VideoService；DB video_projects/photos |
| 62 | 视频 | 选图与排序 | 部分 | 可选择且限制数量；无拖拽/顺序调整 UI |
| 63 | 视频 | 编辑、删除、历史、失败重试 | 部分 | API 存在；页面只突出 latest，无完整管理入口 |
| 64 | 视频 | 状态机、轮询与 Mock | 完整 | QUEUED→PROCESSING→COMPLETED；E2E 最终 100% |
| 65 | 视频 | Free/Pro 限制 | 完整 | 前后端均限制数量及 CITY 模板 |
| 66 | 视频 | FFmpeg 实际输出能力 | 部分 | 能做轮播、分辨率、BGM、Free 水印；能力不完整 |
| 67 | 视频 | 模板/地图/文字/成就渲染 | 未实现 | VideoJob 含开关，renderer 未消费这些字段 |
| 68 | 视频 | 真实 MP4+对象存储 E2E | 无法验证 | 本轮只启用 Mock；未配置真实 worker/R2 凭据 |
| 69 | 付费 | 价格与按 Trip 付费 | 完整 | F ¥29；B 单 Trip payment/plan |
| 70 | 付费 | Free/Pro 后端限制 | 完整 | 地点、照片、视频等服务端校验 |
| 71 | 付费 | Mock checkout | 完整 | E2E 支付记录成功，Trip 升级 PRO |
| 72 | 付费 | Stripe checkout/webhook | 部分 | 代码/HMAC/paid guard 存在；未做真实环境联调 |
| 73 | 付费 | 未支付不升级 | 完整 | webhook 仅 paid 或成功事件升级 |
| 74 | 付费 | 支付取消后的明确 UX | 未实现 | return URL 可带 cancelled，但前端未显示取消态 |
| 75 | 付费 | Stripe 测试/生产环境 | 无法验证 | 无 Stripe/R2 外部凭据 |
| 76 | 付费 | 财务记录保留 | 缺陷 | payments 对 trips 使用级联删除，生产审计留存风险 |
| 77 | 响应式 | PC 导航与布局 | 完整 | sidebar/topbar/max-width 布局 |
| 78 | 响应式 | 平板断点 | 完整 | `<=1100px` 样式存在 |
| 79 | 响应式 | 手机导航与布局 | 完整 | `<=860px` bottom nav 与网格变化 |
| 80 | 响应式 | 多真机/浏览器视觉验收 | 无法验证 | 本轮未执行设备矩阵和截图回归 |
| 81 | 状态处理 | loading/empty | 部分 | 多数主页面有；并非全部异步操作一致覆盖 |
| 82 | 状态处理 | API 错误与重试 | 部分 | 有错误文本；系统性 retry 较少 |
| 83 | 状态处理 | 上传/地图错误 | 缺陷 | 上传缺内容级校验；地图加载失败无明确恢复 UI |
| 84 | 状态处理 | 视频/支付错误 | 缺陷 | 视频失败无重试闭环；支付取消态未展示 |
| 85 | 安全 | BCrypt/JWT/生产密钥 | 完整 | Spring Security；生产弱 secret 校验 |
| 86 | 安全 | 所有权与 IDOR | 完整 | requireOwned/requireWritable；E2E 403/404 |
| 87 | 安全 | 分享 Token 与 webhook 签名 | 完整 | SecureRandom；Stripe HMAC 校验 |
| 88 | 安全 | 上传内容安全 | 缺陷 | 未校验真实图片魔数/解码结果及对象 HEAD 元数据 |
| 89 | 安全 | Token 客户端存储 | 部分 | localStorage 可工作，但扩大 XSS 后 Token 暴露面 |
| 90 | 安全 | 限流/防爆破 | 未实现 | 未找到登录、上传、分享、支付端点限流 |
| 91 | 安全 | 服务端 key/path 控制 | 完整 | storage key 和公开 URL 由后端生成，local path 有 normalize 检查 |
| 92 | 安全 | DB 强约束与所有权模型 | 部分 | FK/唯一索引较全；状态无 CHECK，自定义地点无 owner_user_id |

### 4.2 明确未实现清单

1. 时间轴纳入 itinerary 项。
2. 图库按日期分组、照片详情和编辑。
3. 成就分类筛选。
4. 视频模板、地图、旅行文字、成就在真实 MP4 中渲染。
5. 支付取消状态的前端反馈。
6. 登录及高风险端点限流/防爆破。

---

## 5. 存在缺陷的功能

### 5.1 P0

**未发现已证实的 P0。** 当前没有复现“项目无法启动、所有用户无法登录、核心数据必然丢失或可无条件接管他人账户”的问题。

### 5.2 P1

| 缺陷 | 影响 | 证据 |
|---|---|---|
| 自定义地点/打卡经纬度无服务端范围校验 | 可写入非法地理数据，破坏地图与下游计算 | `PlaceDtos.java:11`、`CheckinDtos.java:12-13`；E2E 已写入 91/181 |
| 上传只相信 MIME/大小声明 | 非图片内容可伪装为图片进入存储，存在安全与内容污染风险 | `PhotoService.java` 的类型判断、LocalStorage PUT 未做图片解码/魔数校验 |
| 删除照片不删除存储对象 | 孤儿文件持续累积，可能泄露已删除内容并增加成本 | `PhotoService.java:26` 仅 `mapper.delete(id)` |
| `/trips/{id}/places` 404 | 明确要求的核心详情子页面不可达 | 本地 HTTP 实测 404 |
| 时间轴遗漏 itinerary | 计划但未打卡的行程无法在统一时间轴出现 | `CheckinService.java:38` 仅查询 `mapper.listByTrip` |
| 图片分享套餐权益错误 | Free/Pro 产物无实际差异；Pro 无水印承诺未兑现 | `share/page.tsx:13,15` 固定 pixelRatio=2，全部模板开放且品牌恒显 |
| 视频真实渲染忽略关键配置 | 用户选择的模板/地图/文字/成就不会进入真实视频 | `VideoJob.java:3` 有字段；`FfmpegRenderer.java` 只使用尺寸、照片、音乐、水印 |
| 分享过期状态不闭环 | 过期链接状态与旅行可见性可能长期不一致 | ShareService 访问时判断时间，但不持久化 EXPIRED/回收 PRIVATE |
| 自定义地点移除后不可重加 | 产生孤儿 places 数据，产品操作不可逆 | PlaceService remove 与 addExisting 对 CUSTOM 的组合行为 |
| 支付记录随 Trip 级联删除 | 财务审计、退款及对账记录可能丢失 | V1 migration payments FK `ON DELETE CASCADE` |
| 错误恢复不完整 | 视频失败、地图失败、支付取消等场景用户无法自助恢复 | 对应页面无 retry/cancel 状态闭环 |

### 5.3 P2

- Trip 编辑/删除、行程/打卡编辑、照片元数据、地点移除和视频项目管理需要补齐页面入口。
- 地图增加当前定位、底图失败提示与生产地图服务策略。
- 图库增加按日期分组、详情、标题/说明编辑。
- 成就增加分类筛选。
- 前端 API 输入大量使用 `any`，应生成或共享 DTO 类型，降低契约漂移。
- 资料页“默认可见性”可保存，但 TripService 新建旅行始终硬编码 PRIVATE；若该偏好不应生效，应从 UI/模型移除以避免误导。

---

## 6. 前后端接口对接问题

### 6.1 契约覆盖

- 前端发现 52 个显式业务 API 方法，另有 1 个内部 `/auth/refresh` 调用，共 53 个调用点。
- 后端 Controller 共发现 58 个端点方法，额外端点主要是本地存储 PUT、Stripe webhook 以及后端可用但页面未接入的能力。
- 本轮没有发现前端调用对应后端完全不存在、HTTP method 明显错误或主路径拼写不一致的情况。
- 主要问题是“接口存在但 UI 未调用”：`removePlace`、`updateItinerary`、`updateCheckin`、`updatePhoto`、`updateVideo`、`deleteVideo` 只在 API client 定义处出现。

### 6.2 DTO/字段问题

- `Photo` 缺少标题、说明/描述字段，因此需求中的照片元数据编辑无法仅靠 UI 补齐。
- `CustomPlaceRequest` 和 Checkin DTO 缺少经纬度范围注解。
- 前端多个写接口以 `input:any` 传参，编译无法发现字段漂移。
- 用户头像是 URL 字段，不是受控上传流程。
- API 错误结构已统一，但前端部分 mutation 没有 `try/catch`，错误无法稳定呈现。

### 6.3 Mock 与真实实现边界

| 能力 | 当前结论 |
|---|---|
| 支付 | Mock 模式真实写 DB 并升级套餐；Stripe 仅静态代码通过，真实链路无法验证 |
| 视频 | Mock 模式真实走项目状态机但返回 `example.invalid`；不是 MP4 产物 |
| 视频 worker | 有 FFmpeg 代码和部署单元，但本轮未与 API 并行启动做真实任务 |
| 对象存储 | Local storage 已验证；R2/S3 代码存在但凭据与公网访问无法验证 |
| 地图 | MapLibre 为真实组件；OSM fallback 可用，但未验证商业生产负载策略 |

---

## 7. 数据库结构问题

### 7.1 已满足

- Flyway V1/V2 能从零校验并启动。
- users、refresh_tokens、official_cities、official_places、trips、trip_places、itinerary_items、checkins、photos、achievements、user_achievements、payments、share_links、video_projects、video_project_photos 等核心表齐备。
- 主要 FK、唯一索引、查询索引和时间字段基本匹配设计文档。
- 官方地点加入旅行具备唯一约束/幂等处理；成就发放具备唯一约束。

### 7.2 风险与偏差

- `places` 没有 `owner_user_id`，自定义地点所有权依赖 trip_places 和服务逻辑，移除关联后成为无主孤儿。
- 状态类字符串字段缺少数据库 CHECK，错误状态可绕过应用层进入 DB。
- `payments.trip_id ON DELETE CASCADE` 不适合需要财务留存的生产系统。
- 照片删除不触发对象存储清理；数据库与存储生命周期不一致。
- 分享链接到期不会由定时任务/访问逻辑持久化为 EXPIRED。
- 当前本机 MySQL 8.0.46 与文档基线 8.4 不一致，应在 CI/部署矩阵明确支持版本。

---

## 8. 页面与交互问题

- Trip 详情缺少编辑、删除和明确的“地点”子页；`/trips/{id}/places` 直接 404。
- 行程和打卡存在更新 API，但页面无法编辑；这会让错误录入只能删除重建。
- 地图没有当前定位；地图样式/网络加载失败时无面向用户的错误态。
- 图库没有日期分组、照片详情、标题/说明编辑。
- 分享工作室没有真正按套餐调整导出分辨率/水印，也没有在城市海报加入地图。
- 视频无法排序照片；历史项目、编辑、删除、失败原因和重试不完整；预览文案为硬编码口号，不是旅行内容。
- 支付取消后没有明确反馈。
- 响应式断点代码齐备，但未做手机/平板/PC 的截图回归，因此视觉层不能判定为全面验收通过。

---

## 9. 安全与权限问题

### 9.1 已验证有效

- BCrypt 密码哈希；JWT Access/Refresh 分离；Refresh Token 服务端哈希、轮换与吊销。
- 生产 profile 会拒绝默认弱 JWT secret。
- Trip、行程、打卡、照片、分享、视频等服务普遍执行 owner/writable 检查。
- E2E 越权测试：读取他人 Trip 返回 403；跨 Trip 行程引用返回 404；引用他人自定义地点返回 403。
- 分享 Token 使用安全随机数；Stripe webhook 有 HMAC 验签逻辑。
- 存储 key 和 image URL 由服务端生成，用户不能直接指定服务器路径。

### 9.2 需要整改

- 上传必须检查真实图片签名/解码结果，并核对存储对象的 Content-Type、Content-Length；不能只相信登记请求。
- Access/Refresh Token 存 localStorage，发生 XSS 时可直接被读取。生产版建议评估 HttpOnly/Secure/SameSite Cookie 或更严格的 CSP 与短 Token 生命周期。
- 未发现登录、注册、预签名、公开分享和支付 webhook 的限流/防爆破方案。
- 自定义地点缺少数据库级 owner，服务层遗漏一次校验就可能产生越权面。
- 公开分享包含时间轴备注与照片；虽然符合当前产品意图，仍应在 UI 明确提示公开数据范围。
- 需要为 CORS、代理头、TLS、Webhook replay protection 和密钥轮换建立部署级验证；本地运行不能覆盖这些生产风险。

---

## 10. 建议修复顺序

### P0：上线阻断

当前无已证实 P0。若准备开放公网，在真实 Stripe/R2/worker 联调完成前，应把“真实支付与视频导出未验”视为发布门禁，而不是已完成功能。

### P1：下个可发布版本前

1. 加入经纬度范围校验、图片真实内容校验、对象元数据核对与删除存储对象。
2. 修复 `/trips/{id}/places` 路由，并补齐 Trip/行程/打卡/照片/地点的核心编辑入口。
3. 时间轴合并 itinerary；定义计划、已完成、取消项的排序与展示规则。
4. 实现 Free/Pro 图片分享的真实水印、分辨率和模板门槛，并补城市海报地图。
5. 让 video-worker 真正消费 template/showText/showMap/showAchievements，完成真实 MP4 E2E 和失败重试。
6. 修复分享过期状态、可见性回收和自定义地点孤儿/重加问题。
7. 调整支付记录删除策略；补 Stripe 测试环境联调、取消/失败 UI 和 webhook 重放防护。
8. 增加后端集成测试、前端组件/E2E、worker 测试；目前 14 个单测不足以保护 58 个后端端点和关键异步链路。

### P2：体验与工程质量

1. 增加当前定位、地图错误恢复、图库日期/详情、成就筛选、视频项目历史管理。
2. 用共享 schema/OpenAPI 生成前端 DTO，移除写接口中的 `any`。
3. 统一 mutation 的 loading/success/error/retry 模式。
4. 用 Playwright 执行 PC/平板/手机截图回归和关键用户旅程。
5. 明确 MySQL 支持版本、对象存储生命周期、日志/指标/告警、备份恢复和数据保留策略。

### 最终判断

项目的 MVP 主数据链路已可运行，适合继续进入“补产品闭环 + 强化安全 + 真实外部集成”的阶段；当前不应宣称全功能生产就绪。最需要防止的误判是：把已有 API client 当成已有页面功能、把 Mock 视频/支付当成真实第三方链路、把能生成 PNG 当成已经实现 Free/Pro 套餐权益。
