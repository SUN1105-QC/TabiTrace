# API 接口设计

2026-10-14 从全部 `@RestController` 整理（共 100 个接口，另加 Spring 的 `/actuator/health`；已用脚本逐条比对，无遗漏）。项目**没有 OpenAPI 文件**，本表就是接口清单；请求和响应字段以后端 `dto/XxxDtos.java` 和前端 `services/tabitrace-api.ts` 为准（两边同名）。

## 1. 约定

| 项目 | 约定 |
|---|---|
| 前缀 | `/api/v1` |
| 格式 | JSON；上传文件不经过 API（预签名直传），本地存储模式下由 `local-storage` 接口接收二进制 |
| 响应 | `{ "success": true, "data": …, "code": null, "message": null }`；失败时 `success=false`，`code` 为错误码，`message` 为中文提示，`data` 可能带补充信息（如 `retryAfter`） |
| 认证 | `Authorization: Bearer <访问令牌>`；refresh 只走 HttpOnly Cookie `tt_refresh`（path `/api/v1`） |
| 权限 | **公开**：不需要登录；**登录**：需要访问令牌，并在 Service 层校验资源属于当前用户；**本人旅行**：路径里的 tripId 必须属于当前用户 |
| 时间 | 请求和响应用 ISO 8601；带时区的时刻用 `OffsetDateTime` |
| 错误码 | 见 [异常与错误码设计](03_异常与错误码设计.md) |

## 2. 接口清单

### 认证 `/auth`（公开）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/email-verification/send` | 发送验证码（`purpose`: register / reset_password），限流 |
| POST | `/auth/email-verification/verify` | 校验验证码，返回一次性 `emailVerificationToken` |
| POST | `/auth/register` | 注册（需要邮箱验证令牌），返回访问令牌并写 refresh Cookie |
| POST | `/auth/login` | 登录（`cancelDeletion` 用于撤销注销），限流 |
| POST | `/auth/password-reset` | 用邮箱验证令牌重置密码，撤销所有会话后登录当前设备 |
| POST | `/auth/refresh` | 用 Cookie 换新访问令牌（refresh 轮换）；检查请求来源，跨站返回 `CROSS_SITE_REQUEST` |
| POST | `/auth/logout` | 退出当前设备并清 Cookie（幂等）；同样检查请求来源 |

### 当前用户 `/users/me`（登录）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / PUT | `/users/me` | 读取 / 修改资料与偏好 |
| GET | `/users/me/overview` | 账户概览：旅行、地点、照片数，FREE 名额，每段旅行的方案与支付，价格 |
| GET | `/users/me/usage` | 当前账号 UTC 日视频用量、启用的账号限额及登记媒体空间估算；不返回其他账号或全站用量 |
| POST | `/users/me/avatar/presign` | 头像上传地址 |
| PUT / DELETE | `/users/me/avatar` | 保存（原图 + 小图）/ 移除头像 |
| POST | `/users/me/password` | 修改密码（退出其他设备） |
| POST | `/users/me/deletion` | 申请注销（需要密码） |
| GET | `/users/me/sessions` | 登录设备列表 |
| DELETE | `/users/me/sessions/{id}` | 退出某台设备（不能是当前设备） |
| POST | `/users/me/sessions/revoke-others` | 退出其他所有设备 |
| GET | `/membership` | 当前会员状态 |
| GET | `/me/memories`、`/me/memories/trips` | 旅行回忆（精选、那年今日、旅行列表） |

### 旅行 `/trips`（登录，本人旅行）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/trips` | 列表 / 创建（FREE 名额、加入官方探索） |
| GET / PUT / DELETE | `/trips/{id}` | 详情 / 修改（归档后不可）/ 删除 |
| POST | `/trips/{id}/archive`、`/trips/{id}/unarchive` | 归档 / 取消归档 |
| GET | `/trips/{id}/summary` | 总结与成果准备度 |
| POST | `/trips/{id}/complete` | 标记完成 |

成就 API 已于 2026-10-29 移除；不再开放 `GET /trips/{tripId}/achievements`。旧响应中的成就兼容字段固定为空 / 0，通知与视频开关固定为 false。

### 目的地、官方城市、地点
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/destinations/search?q=&limit=` | 登录 | 创建旅行时的目的地搜索 |
| GET | `/official-cities`、`/official-cities/{code}` | 公开 | 官方城市 |
| GET | `/official-cities/{code}/places`、`/official-cities/{code}/routes` | 公开 | 官方地点、专题路线 |
| POST | `/trips/{tripId}/official-places/{placeId}` | 本人旅行 | 加入官方地点 |
| GET | `/places/search?q=` | 公开 | 地点搜索 |
| GET | `/places/{id}` | 登录 | 地点详情（只返回官方地点，自定义地点一律 404） |
| GET / POST | `/trips/{tripId}/places` | 本人旅行 | 旅行内地点 / 加入已有地点 |
| POST | `/trips/{tripId}/places/custom` | 本人旅行 | 创建自定义地点 |
| DELETE | `/trips/{tripId}/places/{placeId}` | 本人旅行 | 从旅行移除地点 |
| GET | `/me/favorite-places` | 登录 | 收藏的地点 id |
| POST / DELETE | `/places/{id}/favorite` | 登录 | 收藏 / 取消收藏 |

### 行程与打卡（本人旅行）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/trips/{tripId}/itinerary` | 行程列表 / 新增 |
| PUT / DELETE | `/trips/{tripId}/itinerary/{itemId}` | 修改 / 删除 |
| POST | `/trips/{tripId}/itinerary/{itemId}/checkin` | 行程转打卡 |
| GET / POST | `/trips/{tripId}/checkins` | 打卡列表 / 手动打卡 |
| POST | `/trips/{tripId}/quick-checkins` | 快速打卡（打卡 + 天气 + 照片元数据一个事务） |
| PUT / DELETE | `/checkins/{id}` | 修改 / 删除打卡 |
| GET | `/trips/{tripId}/timeline` | 时间轴（按天，含照片） |
| GET | `/trips/{tripId}/recent-records?limit=` | 最近记录（最多 5 条） |
| GET | `/geo/reverse?lat=&lng=&accuracy=&tripId=` | 逆地理（拿不到返回 null） |
| GET | `/geo/weather?lat=&lng=&at=` | 天气快照（拿不到返回 null） |

### 照片（本人旅行）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/trips/{tripId}/photos/presign` | 上传地址（原图或 `variantOf` + `variant` 的尺寸版本） |
| POST | `/trips/{tripId}/photos` | 登记照片 |
| GET | `/trips/{tripId}/photos` | 全部照片 |
| GET | `/trips/{tripId}/photos/page?filter=&sort=&cursor=&limit=` | 照片墙分页（filter: ALL / FEATURED / LINKED / UNLINKED） |
| PUT / DELETE | `/photos/{id}` | 修改关联打卡与拍摄时间 / 删除（含存储对象） |
| POST / DELETE | `/photos/{id}/feature` | 精选 / 取消精选 |
| POST | `/trips/{tripId}/photos/{photoId}/cover` | 设为旅行封面 |
| POST | `/trips/{tripId}/photos/batch` | 批量 FEATURE / UNFEATURE / DELETE |
| PUT | `/local-storage/upload?key=&expires=&signature=` | 公开（凭签名）：本地存储模式的上传入口 |
| GET | `/local-storage/file?key=&…` | 公开（私有文件需签名）：本地存储模式的读取入口 |

### 分享
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET / POST | `/trips/{tripId}/share-links` | 本人旅行 | 链接列表 / 创建 |
| DELETE | `/trips/{tripId}/share-links/{shareId}` | 本人旅行 | 撤销 |
| GET | `/share/{token}` | 公开（令牌） | 公开分享数据（坐标默认粗化） |

### Travel Story
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/video-templates`、`/video-music` | 登录 | 模板与曲库（只返回可用曲目） |
| GET / POST | `/trips/{tripId}/video-projects` | 本人旅行 | 视频项目列表 / 新建草稿 |
| POST | `/trips/{tripId}/video-storyboard` | 本人旅行 | 按当前设置生成分镜预览（不保存） |
| GET / PUT / DELETE | `/video-projects/{id}` | 本人 | 详情 / 修改草稿 / 删除（生成中不可删） |
| GET | `/video-projects/{id}/storyboard` | 本人 | 分镜（已生成的返回冻结版本） |
| POST | `/video-projects/{id}/render` | 本人 | 开始生成（重新校验、冻结分镜、入队） |
| POST | `/video-projects/{id}/duplicate` | 本人 | 复制为新草稿（重新编辑） |
| GET | `/dev/music-licenses` | 只在 local profile 存在 | 开发用音乐版权后台 |

### 我的音乐 `/user/music`（登录 + 会员）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/user/music` | 音乐库与全部限制数值（非会员也能读取，用于展示） |
| POST | `/user/music/upload-url` | 申请上传地址（需版权确认） |
| POST | `/user/music` | 上传完成，服务端检查文件 |
| PATCH | `/user/music/{id}` | 重命名（⚠ CORS 允许的方法里没有 PATCH，本地跨域开发时可能被浏览器拦截，见技术债） |
| DELETE | `/user/music/{id}` | 删除 |
| GET | `/user/music/{id}/play-url` | 试听地址（短时签名） |

### 支付与方案
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/plans/trip-pro` | 公开 | 方案配置：价格、FREE 限制、Story / 分享图规格、模板与曲库目录、能否付款；`videoUsageLimits` 返回实际生效的视频限额开关、每日次数和累计成片秒数，供购买前展示 |
| POST | `/trips/{tripId}/payments/checkout` | 本人旅行 | Trip Pro 付款（mock 时立即成功） |
| GET | `/trips/{tripId}/payments/latest` | 本人旅行 | 最近一次支付 |
| POST | `/payments/lifetime/checkout` | 登录 | 终身 Pro 付款 |
| GET | `/payments/lifetime/latest` | 登录 | 最近一次终身 Pro 支付 |
| GET | `/payments` | 登录 | 本人最近 100 条付款记录，包含退款金额 |
| GET | `/payments/{id}` | 本人订单 | 查询本地订单，不触发渠道请求 |
| POST | `/payments/{id}/refresh` | 本人订单 | 查询渠道并同步状态，同订单 10 秒内合并查询 |
| POST | `/payments/{id}/resume` | 本人订单 | 继续原订单，复用 Stripe Session / 幂等键 |
| POST | `/payments/{id}/cancel` | 本人订单 | 关闭仍开放的 Checkout，不执行退款 |
| POST | `/payments/stripe/webhook` | 公开（Stripe 签名） | Stripe 回调 |

### 运维
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/actuator/health` | 健康检查（不在 `/api/v1` 下；生产不展示细节） |
