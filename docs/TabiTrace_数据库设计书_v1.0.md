**旅迹 TabiTrace**

**数据库设计书**

Database Design Specification

**版本：v1.0**

基线：TabiTrace Backend v4

数据库：MySQL 8.4 LTS · Flyway · utf8mb4

更新日期：2026-09-16

本设计书以 Backend v4 的 V1\_\_initial_schema.sql、V2\_\_seed_tokyo_and_achievements.sql 与当前 MyBatis 查询逻辑为事实基线。

# 1. 文档说明

| **项目**  | **内容**                                                                                                                    |
|-----------|-----------------------------------------------------------------------------------------------------------------------------|
| 文档目的  | 定义 TabiTrace 当前后端数据库的物理结构、表关系、索引、状态语义和数据一致性规则，作为后端开发、联调、测试和运维的共同基线。 |
| 适用范围  | TabiTrace Backend v4 / MVP 阶段。                                                                                           |
| 数据库    | MySQL 8.4 LTS，InnoDB，utf8mb4，utf8mb4_0900_ai_ci。                                                                        |
| Migration | Flyway；当前基线为 V1\_\_initial_schema.sql + V2\_\_seed_tokyo_and_achievements.sql。                                       |
| 时间策略  | 事件时间以 UTC 写入 DATETIME(6)；旅行起止日期使用 DATE；planned_time 使用 TIME。                                            |
| 对象存储  | 照片与视频二进制不存 MySQL；数据库保存 storage_key / output_key 与访问 URL。                                                |

# 2. 设计原则

- 以 Trip 为核心业务边界：打卡、照片、行程、成就、分享、支付和视频最终都与具体旅行关联。

- 官方地点与用户自定义地点共用 places 主数据，通过 source_type 区分；旅行与地点使用 trip_places 多对多关联。

- 历史事实优先可读：checkins 保存 place_name_snapshot 与 area_snapshot，避免地点主数据后续修改影响历史记录。

- Free / Pro 权限按 trips.plan_type 生效，而不是用户全局会员。

- 隐私默认 PRIVATE；对外分享通过不可预测 share_token 实现 UNLISTED 访问。

- 照片与视频只在数据库保存元数据，实际文件由 Cloudflare R2 / 本地联调存储负责。

- 所有结构变化通过 Flyway Migration 管理，禁止生产环境手工漂移。

# 3. 数据模型总览

**当前共 15 张业务表。核心关系如下：**

users 1 ── N trips  
users 1 ── N refresh_tokens  
trips 1 ── N trip_places N ── 1 places  
trips 1 ── N itinerary_items  
trips 1 ── N checkins ── N photos  
trips 1 ── N user_achievements N ── 1 achievements  
trips 1 ── N payments  
trips 1 ── N share_links  
trips 1 ── N video_projects 1 ── N video_project_photos N ── 1 photos  
official_cities ──(逻辑上按 code/city 管理)── official places / city achievements

| **表名**             | **用途**                       | **主要字段数** |
|----------------------|--------------------------------|----------------|
| users                | 用户账号与偏好                 | 12             |
| refresh_tokens       | 刷新令牌生命周期               | 6              |
| official_cities      | 官方城市内容元数据             | 9              |
| places               | 地点主数据（官方与自定义共用） | 15             |
| trips                | 用户旅行主体                   | 15             |
| trip_places          | 旅行与地点关联                 | 5              |
| itinerary_items      | 计划行程条目                   | 14             |
| checkins             | 旅行打卡事实表                 | 14             |
| photos               | 旅行照片元数据                 | 13             |
| achievements         | 成就定义                       | 10             |
| user_achievements    | 用户获得成就记录               | 5              |
| payments             | Trip Pro 支付记录              | 11             |
| share_links          | 非公开分享链接                 | 8              |
| video_projects       | 旅行视频生成任务               | 18             |
| video_project_photos | 视频项目选图与顺序             | 6              |

# 4. 关键业务关系

| **关系**    | **实现**                              | **说明**                                                               |
|-------------|---------------------------------------|------------------------------------------------------------------------|
| 用户 → 旅行 | users.id → trips.user_id              | 用户删除时旅行级联删除。                                               |
| 旅行 ↔ 地点 | trip_places(trip_id, place_id)        | 官方地点可跨旅行复用；自定义地点由业务层限制只能在创建它的旅行中使用。 |
| 行程 → 打卡 | checkins.itinerary_item_id            | 计划行程可以转换为打卡；删除行程时打卡保留但关联置空。                 |
| 打卡 → 照片 | photos.checkin_id                     | 照片可关联打卡；删除打卡时照片保留但 checkin_id 置空。                 |
| 旅行 → Pro  | trips.plan_type + payments            | 支付 Webhook 成功后将对应旅行升级为 PRO。                              |
| 旅行 → 分享 | share_links                           | 旅行可存在历史分享记录；ACTIVE + 未过期 Token 才可访问。               |
| 旅行 → 视频 | video_projects / video_project_photos | 视频项目独立排队；选用照片通过关联表保存顺序。                         |

# 5. 状态与枚举约定

| **字段**               | **当前值**                                   | **说明**                                          |
|------------------------|----------------------------------------------|---------------------------------------------------|
| trips.plan_type        | FREE, PRO                                    | 当前套餐按旅行生效。                              |
| trips.status           | PLANNING, ONGOING, COMPLETED                 | 新建为 PLANNING；业务层可切换 ONGOING/COMPLETED。 |
| trips.visibility       | PRIVATE, UNLISTED                            | MVP 不提供公开广场 PUBLIC。                       |
| places.source_type     | OFFICIAL, CUSTOM                             | 官方主数据与用户自定义地点。                      |
| checkins.checkin_type  | MANUAL（预留 GPS）                           | MVP 采用手动打卡/补录。                           |
| achievements.type      | GLOBAL, CITY                                 | 通用成就或官方城市成就。                          |
| share_links.status     | ACTIVE, REVOKED                              | 撤销后 Token 不再可访问。                         |
| payments.status        | PENDING, PAID                                | Stripe/Mock 支付主要状态。                        |
| video_projects.status  | DRAFT, QUEUED, PROCESSING, COMPLETED, FAILED | 视频任务生命周期。                                |
| official_cities.status | DRAFT, ACTIVE, DISABLED                      | 当前查询仅返回 ACTIVE。                           |

# 6. 详细数据字典

## 6.1 users

**用户账号与偏好**

| **字段**            | **类型**     | **空值 / 默认**           | **键 / 索引** | **说明**                        |
|---------------------|--------------|---------------------------|---------------|---------------------------------|
| id                  | BIGINT       | NOT NULL / AUTO_INCREMENT | PK            | 用户主键                        |
| email               | VARCHAR(255) | NOT NULL                  | UNIQUE        | 登录邮箱，全局唯一              |
| password_hash       | VARCHAR(255) | NOT NULL                  |               | BCrypt 等安全哈希后的密码       |
| nickname            | VARCHAR(100) | NOT NULL                  |               | 用户昵称                        |
| avatar_url          | VARCHAR(500) | NULL                      |               | 头像 URL                        |
| status              | VARCHAR(30)  | NOT NULL / ACTIVE         |               | 账号状态，当前默认 ACTIVE       |
| locale              | VARCHAR(20)  | NOT NULL / zh-CN          |               | 界面语言偏好                    |
| timezone            | VARCHAR(50)  | NOT NULL / Asia/Tokyo     |               | 用户时区，用于 UTC 时间展示转换 |
| default_visibility  | VARCHAR(20)  | NOT NULL / PRIVATE        |               | 新建旅行默认可见性              |
| email_notifications | BOOLEAN      | NOT NULL / TRUE           |               | 邮件通知开关                    |
| created_at          | DATETIME(6)  | NOT NULL                  |               | 创建时间，UTC                   |
| updated_at          | DATETIME(6)  | NOT NULL                  |               | 更新时间，UTC                   |

## 6.2 refresh_tokens

**刷新令牌生命周期**

| **字段**   | **类型**     | **空值 / 默认**           | **键 / 索引** | **说明**                   |
|------------|--------------|---------------------------|---------------|----------------------------|
| id         | BIGINT       | NOT NULL / AUTO_INCREMENT | PK            | 刷新令牌记录主键           |
| user_id    | BIGINT       | NOT NULL                  | FK → users.id | 所属用户                   |
| jti        | VARCHAR(100) | NOT NULL                  | UNIQUE        | JWT Refresh Token 唯一标识 |
| expires_at | DATETIME(6)  | NOT NULL                  |               | 失效时间，UTC              |
| revoked_at | DATETIME(6)  | NULL                      |               | 撤销时间；非空表示已失效   |
| created_at | DATETIME(6)  | NOT NULL                  |               | 创建时间，UTC              |

## 6.3 official_cities

**官方城市内容元数据**

| **字段**     | **类型**     | **空值 / 默认**           | **键 / 索引** | **说明**                             |
|--------------|--------------|---------------------------|---------------|--------------------------------------|
| id           | BIGINT       | NOT NULL / AUTO_INCREMENT | PK            | 官方城市主键                         |
| code         | VARCHAR(50)  | NOT NULL                  | UNIQUE        | 城市代码，例如 TOKYO                 |
| name         | VARCHAR(100) | NOT NULL                  |               | 展示名称                             |
| country_code | VARCHAR(10)  | NOT NULL                  |               | 国家/地区代码，例如 JP               |
| description  | TEXT         | NULL                      |               | 官方城市说明                         |
| cover_image  | VARCHAR(500) | NULL                      |               | 城市封面图                           |
| status       | VARCHAR(20)  | NOT NULL / DRAFT          |               | DRAFT / ACTIVE / DISABLED 等内容状态 |
| theme        | VARCHAR(50)  | NULL                      |               | 视觉主题代码，例如 TOKYO_WARM        |
| created_at   | DATETIME(6)  | NOT NULL                  |               | 创建时间，UTC                        |

## 6.4 places

**地点主数据（官方与自定义共用）**

| **字段**     | **类型**      | **空值 / 默认**           | **键 / 索引**                           | **说明**           |
|--------------|---------------|---------------------------|-----------------------------------------|--------------------|
| id           | BIGINT        | NOT NULL / AUTO_INCREMENT | PK                                      | 地点主键           |
| name         | VARCHAR(200)  | NOT NULL                  | idx_places_search                       | 地点名称           |
| country_code | VARCHAR(10)   | NULL                      |                                         | 国家/地区代码      |
| country      | VARCHAR(100)  | NULL                      |                                         | 国家名称           |
| city         | VARCHAR(100)  | NULL                      | idx_places_search / idx_places_official | 城市名称           |
| area         | VARCHAR(100)  | NULL                      | idx_places_search                       | 区域/街区          |
| address      | VARCHAR(500)  | NULL                      |                                         | 地址               |
| latitude     | DECIMAL(10,7) | NULL                      |                                         | 纬度               |
| longitude    | DECIMAL(10,7) | NULL                      |                                         | 经度               |
| category     | VARCHAR(50)   | NULL                      |                                         | 地点分类           |
| source_type  | VARCHAR(20)   | NOT NULL                  | idx_places_official                     | OFFICIAL 或 CUSTOM |
| description  | TEXT          | NULL                      |                                         | 地点说明           |
| cover_image  | VARCHAR(500)  | NULL                      |                                         | 地点封面图         |
| created_at   | DATETIME(6)   | NOT NULL                  |                                         | 创建时间，UTC      |
| updated_at   | DATETIME(6)   | NOT NULL                  |                                         | 更新时间，UTC      |

- CUSTOM 地点没有单独 owner_user_id；当前归属由其被创建时写入 trip_places，并由服务层限制跨旅行使用。

- 公开地点搜索只查询 source_type=OFFICIAL。

## 6.5 trips

**用户旅行主体**

| **字段**         | **类型**     | **空值 / 默认**           | **键 / 索引**  | **说明**                        |
|------------------|--------------|---------------------------|----------------|---------------------------------|
| id               | BIGINT       | NOT NULL / AUTO_INCREMENT | PK             | 旅行主键                        |
| user_id          | BIGINT       | NOT NULL                  | FK → users.id  | 旅行所属用户                    |
| title            | VARCHAR(200) | NOT NULL                  |                | 旅行标题                        |
| destination_name | VARCHAR(200) | NOT NULL                  |                | 目的地展示名称                  |
| country_code     | VARCHAR(10)  | NULL                      |                | 目的国家/地区代码               |
| city             | VARCHAR(100) | NULL                      |                | 主要城市                        |
| start_date       | DATE         | NOT NULL                  | idx_trips_user | 开始日期；日期字段不做 UTC 转换 |
| end_date         | DATE         | NOT NULL                  |                | 结束日期                        |
| people_count     | INT          | NOT NULL / 1              |                | 同行人数                        |
| cover_image      | VARCHAR(500) | NULL                      |                | 旅行封面图                      |
| plan_type        | VARCHAR(20)  | NOT NULL / FREE           |                | FREE / PRO，按旅行单独付费      |
| status           | VARCHAR(30)  | NOT NULL / PLANNING       |                | PLANNING / ONGOING / COMPLETED  |
| visibility       | VARCHAR(20)  | NOT NULL / PRIVATE        |                | PRIVATE / UNLISTED              |
| created_at       | DATETIME(6)  | NOT NULL                  |                | 创建时间，UTC                   |
| updated_at       | DATETIME(6)  | NOT NULL                  |                | 更新时间，UTC                   |

- start_date/end_date 为本地日历日期，不应转换为 UTC。

- status 与 visibility 的合法值主要由业务层校验，当前 DDL 未使用 CHECK 约束。

## 6.6 trip_places

**旅行与地点关联**

| **字段**                  | **类型**    | **空值 / 默认**           | **键 / 索引**         | **说明**                     |
|---------------------------|-------------|---------------------------|-----------------------|------------------------------|
| id                        | BIGINT      | NOT NULL / AUTO_INCREMENT | PK                    | 关联主键                     |
| trip_id                   | BIGINT      | NOT NULL                  | FK → trips.id         | 旅行                         |
| place_id                  | BIGINT      | NOT NULL                  | FK → places.id        | 地点                         |
| sort_order                | INT         | NOT NULL / 0              | idx_trip_places_order | 旅行内地点排序               |
| created_at                | DATETIME(6) | NOT NULL                  |                       | 关联创建时间，UTC            |
| UNIQUE(trip_id, place_id) | \-          | \-                        | uk_trip_place         | 同一旅行不能重复加入同一地点 |

## 6.7 itinerary_items

**计划行程条目**

| **字段**          | **类型**      | **空值 / 默认**           | **键 / 索引**           | **说明**                           |
|-------------------|---------------|---------------------------|-------------------------|------------------------------------|
| id                | BIGINT        | NOT NULL / AUTO_INCREMENT | PK                      | 行程条目主键                       |
| trip_id           | BIGINT        | NOT NULL                  | FK → trips.id           | 所属旅行                           |
| place_id          | BIGINT        | NULL                      | FK → places.id          | 可关联正式地点；手工临时行程可为空 |
| custom_place_name | VARCHAR(200)  | NULL                      |                         | 无 place_id 时的手工地点名称       |
| area              | VARCHAR(100)  | NULL                      |                         | 区域快照                           |
| planned_date      | DATE          | NOT NULL                  | idx_itinerary_trip_date | 计划日期                           |
| planned_time      | TIME          | NULL                      | idx_itinerary_trip_date | 计划时间                           |
| note              | TEXT          | NULL                      |                         | 计划备注                           |
| latitude          | DECIMAL(10,7) | NULL                      |                         | 手工行程纬度                       |
| longitude         | DECIMAL(10,7) | NULL                      |                         | 手工行程经度                       |
| status            | VARCHAR(20)   | NOT NULL / PLANNED        |                         | 计划状态；完成打卡后由业务层更新   |
| sort_order        | INT           | NOT NULL / 0              |                         | 同日期下排序                       |
| created_at        | DATETIME(6)   | NOT NULL                  |                         | 创建时间，UTC                      |
| updated_at        | DATETIME(6)   | NOT NULL                  |                         | 更新时间，UTC                      |

- place_id 和 custom_place_name 二选一由业务逻辑保证，DDL 当前未加 CHECK。

## 6.8 checkins

**旅行打卡事实表**

| **字段**            | **类型**      | **空值 / 默认**           | **键 / 索引**           | **说明**                           |
|---------------------|---------------|---------------------------|-------------------------|------------------------------------|
| id                  | BIGINT        | NOT NULL / AUTO_INCREMENT | PK                      | 打卡主键                           |
| trip_id             | BIGINT        | NOT NULL                  | FK → trips.id           | 所属旅行                           |
| place_id            | BIGINT        | NULL                      | FK → places.id          | 官方/自定义地点；纯手工地点可为空  |
| user_id             | BIGINT        | NOT NULL                  | FK → users.id           | 打卡用户                           |
| itinerary_item_id   | BIGINT        | NULL                      | FK → itinerary_items.id | 由计划行程转化时关联               |
| checkin_type        | VARCHAR(20)   | NOT NULL / MANUAL         |                         | MVP 为 MANUAL；预留 GPS            |
| checkin_time        | DATETIME(6)   | NOT NULL                  | idx_checkins_trip_time  | 实际打卡时间，UTC                  |
| latitude            | DECIMAL(10,7) | NULL                      |                         | 打卡纬度/地点坐标快照              |
| longitude           | DECIMAL(10,7) | NULL                      |                         | 打卡经度/地点坐标快照              |
| place_name_snapshot | VARCHAR(200)  | NOT NULL                  |                         | 打卡时地点名称快照，保证历史可读性 |
| area_snapshot       | VARCHAR(100)  | NULL                      |                         | 打卡时区域快照，用于统计           |
| note                | TEXT          | NULL                      |                         | 旅行记录/打卡笔记                  |
| created_at          | DATETIME(6)   | NOT NULL                  |                         | 创建时间，UTC                      |
| updated_at          | DATETIME(6)   | NOT NULL                  |                         | 更新时间，UTC                      |

- place_id 可为空，用于临时手工地点；此时必须有 place_name_snapshot。

- 官方探索度按 DISTINCT place_id 统计，避免重复打卡重复计数。

## 6.9 photos

**旅行照片元数据**

| **字段**    | **类型**      | **空值 / 默认**           | **键 / 索引**       | **说明**                     |
|-------------|---------------|---------------------------|---------------------|------------------------------|
| id          | BIGINT        | NOT NULL / AUTO_INCREMENT | PK                  | 照片主键                     |
| user_id     | BIGINT        | NOT NULL                  | FK → users.id       | 照片所属用户                 |
| trip_id     | BIGINT        | NOT NULL                  | FK → trips.id       | 所属旅行                     |
| checkin_id  | BIGINT        | NULL                      | FK → checkins.id    | 可选关联具体打卡             |
| storage_key | VARCHAR(500)  | NOT NULL                  |                     | R2/本地存储对象 Key          |
| image_url   | VARCHAR(1000) | NOT NULL                  |                     | 由后端存储服务生成的访问 URL |
| width       | INT           | NULL                      |                     | 图片宽度像素                 |
| height      | INT           | NULL                      |                     | 图片高度像素                 |
| file_size   | BIGINT        | NULL                      |                     | 文件大小字节数               |
| mime_type   | VARCHAR(100)  | NOT NULL                  |                     | MIME 类型，业务要求 image/\* |
| is_featured | BOOLEAN       | NOT NULL / FALSE          | idx_photos_featured | 是否作为分享图/视频精选素材  |
| captured_at | DATETIME(6)   | NULL                      | idx_photos_trip     | 照片拍摄时间，UTC            |
| created_at  | DATETIME(6)   | NOT NULL                  |                     | 记录创建时间，UTC            |

- 服务层要求 storage_key 前缀为 users/{userId}/trips/{tripId}/，并校验文件已上传。

- Free 旅行最多保存 10 张照片；单张照片当前上限 20MB。

## 6.10 achievements

**成就定义**

| **字段**        | **类型**     | **空值 / 默认**           | **键 / 索引** | **说明**                     |
|-----------------|--------------|---------------------------|---------------|------------------------------|
| id              | BIGINT       | NOT NULL / AUTO_INCREMENT | PK            | 成就主键                     |
| code            | VARCHAR(100) | NOT NULL                  | UNIQUE        | 稳定业务代码                 |
| name            | VARCHAR(100) | NOT NULL                  |               | 成就名称                     |
| description     | TEXT         | NULL                      |               | 成就说明                     |
| type            | VARCHAR(20)  | NOT NULL                  |               | GLOBAL / CITY                |
| city_code       | VARCHAR(50)  | NULL                      |               | 城市成就对应城市代码         |
| icon_url        | VARCHAR(500) | NULL                      |               | 成就图标                     |
| condition_type  | VARCHAR(50)  | NOT NULL                  |               | 规则类型，例如 CHECKIN_COUNT |
| condition_value | INT          | NOT NULL / 1              |               | 规则阈值                     |
| created_at      | DATETIME(6)  | NOT NULL                  |               | 创建时间，UTC                |

## 6.11 user_achievements

**用户获得成就记录**

| **字段**                                 | **类型**    | **空值 / 默认**           | **键 / 索引**            | **说明**                     |
|------------------------------------------|-------------|---------------------------|--------------------------|------------------------------|
| id                                       | BIGINT      | NOT NULL / AUTO_INCREMENT | PK                       | 获得记录主键                 |
| user_id                                  | BIGINT      | NOT NULL                  | FK → users.id            | 用户                         |
| trip_id                                  | BIGINT      | NULL                      | FK → trips.id            | 关联旅行                     |
| achievement_id                           | BIGINT      | NOT NULL                  | FK → achievements.id     | 成就                         |
| earned_at                                | DATETIME(6) | NOT NULL                  |                          | 获得时间，UTC                |
| UNIQUE(user_id, trip_id, achievement_id) | \-          | \-                        | uk_user_trip_achievement | 避免同一旅行重复发放同一成就 |

- trip_id 虽允许 NULL，但当前旅行成就流程使用具体 trip_id。

## 6.12 payments

**Trip Pro 支付记录**

| **字段**            | **类型**     | **空值 / 默认**           | **键 / 索引**         | **说明**                               |
|---------------------|--------------|---------------------------|-----------------------|----------------------------------------|
| id                  | BIGINT       | NOT NULL / AUTO_INCREMENT | PK                    | 支付主键                               |
| user_id             | BIGINT       | NOT NULL                  | FK → users.id         | 支付用户                               |
| trip_id             | BIGINT       | NOT NULL                  | FK → trips.id         | 升级的具体旅行                         |
| provider            | VARCHAR(30)  | NOT NULL                  |                       | MOCK / STRIPE                          |
| provider_payment_id | VARCHAR(255) | NULL                      | idx_payments_provider | Stripe Checkout Session 等外部支付标识 |
| amount              | INT          | NOT NULL                  |                       | 最小货币单位金额；当前 CNY 12800（128 元）|
| currency            | VARCHAR(10)  | NOT NULL                  |                       | 货币代码，当前 CNY                     |
| status              | VARCHAR(30)  | NOT NULL                  |                       | PENDING / PAID 等支付状态              |
| paid_at             | DATETIME(6)  | NULL                      |                       | 支付确认时间，UTC                      |
| created_at          | DATETIME(6)  | NOT NULL                  |                       | 创建时间，UTC                          |
| updated_at          | DATETIME(6)  | NOT NULL                  |                       | 更新时间，UTC                          |

- 金额使用整数；当前 Trip Pro 为 490 JPY。

- Stripe 模式以 Webhook 的支付完成状态为最终依据，成功后更新 trips.plan_type=PRO。

## 6.13 share_links

**非公开分享链接**

| **字段**    | **类型**     | **空值 / 默认**           | **键 / 索引**         | **说明**                  |
|-------------|--------------|---------------------------|-----------------------|---------------------------|
| id          | BIGINT       | NOT NULL / AUTO_INCREMENT | PK                    | 分享记录主键              |
| trip_id     | BIGINT       | NOT NULL                  | FK → trips.id         | 关联旅行                  |
| share_token | VARCHAR(100) | NOT NULL                  | UNIQUE                | 公开 URL 中不可预测 Token |
| status      | VARCHAR(20)  | NOT NULL / ACTIVE         | idx_share_trip_status | ACTIVE / REVOKED          |
| view_count  | BIGINT       | NOT NULL / 0              |                       | 访问计数                  |
| created_at  | DATETIME(6)  | NOT NULL                  |                       | 创建时间，UTC             |
| expires_at  | DATETIME(6)  | NULL                      |                       | 可选失效时间，UTC         |
| revoked_at  | DATETIME(6)  | NULL                      |                       | 撤销时间，UTC             |

- 数据库没有额外 visibility 列；UNLISTED 的访问能力由 ACTIVE share_token 与 trips.visibility 配合实现。

## 6.14 video_projects

**旅行视频生成任务**

| **字段**          | **类型**      | **空值 / 默认**           | **键 / 索引**   | **说明**                                         |
|-------------------|---------------|---------------------------|-----------------|--------------------------------------------------|
| id                | BIGINT        | NOT NULL / AUTO_INCREMENT | PK              | 视频项目主键                                     |
| user_id           | BIGINT        | NOT NULL                  | FK → users.id   | 项目所属用户                                     |
| trip_id           | BIGINT        | NOT NULL                  | FK → trips.id   | 关联旅行                                         |
| template_code     | VARCHAR(50)   | NOT NULL                  |                 | JOURNAL / MINIMAL / CITY                         |
| aspect_ratio      | VARCHAR(20)   | NOT NULL                  |                 | MVP 仅支持 9:16                                  |
| duration          | INT           | NOT NULL                  |                 | MVP 固定 30 秒                                   |
| music_code        | VARCHAR(50)   | NOT NULL                  |                 | NONE 或平台音乐代码                              |
| show_text         | BOOLEAN       | NOT NULL / TRUE           |                 | 是否展示旅行文字                                 |
| show_map          | BOOLEAN       | NOT NULL / TRUE           |                 | 是否展示地图                                     |
| show_achievements | BOOLEAN       | NOT NULL / TRUE           |                 | 是否展示成就                                     |
| status            | VARCHAR(30)   | NOT NULL / DRAFT          | idx_video_queue | DRAFT / QUEUED / PROCESSING / COMPLETED / FAILED |
| progress          | INT           | NOT NULL / 0              |                 | 0-100 生成进度                                   |
| output_key        | VARCHAR(500)  | NULL                      |                 | 生成 MP4 的对象存储 Key                          |
| output_url        | VARCHAR(1000) | NULL                      |                 | 视频访问/下载 URL                                |
| error_message     | TEXT          | NULL                      |                 | 生成失败信息                                     |
| created_at        | DATETIME(6)   | NOT NULL                  |                 | 创建时间，UTC                                    |
| updated_at        | DATETIME(6)   | NOT NULL                  |                 | 更新时间，UTC                                    |
| completed_at      | DATETIME(6)   | NULL                      |                 | 生成完成时间，UTC                                |

- MVP 只支持 9:16、30 秒；模板 JOURNAL/MINIMAL/CITY。

- FREE 最多选择 10 张照片；PRO 当前最多 30 张。

## 6.15 video_project_photos

**视频项目选图与顺序**

| **字段**                           | **类型**     | **空值 / 默认**           | **键 / 索引**          | **说明**                     |
|------------------------------------|--------------|---------------------------|------------------------|------------------------------|
| id                                 | BIGINT       | NOT NULL / AUTO_INCREMENT | PK                     | 视频照片关联主键             |
| video_project_id                   | BIGINT       | NOT NULL                  | FK → video_projects.id | 视频项目                     |
| photo_id                           | BIGINT       | NOT NULL                  | FK → photos.id         | 使用的旅行照片               |
| sort_order                         | INT          | NOT NULL                  | idx_video_photo_order  | 视频中的照片顺序             |
| duration                           | DECIMAL(5,2) | NULL                      |                        | 单张图片展示时长（秒）       |
| created_at                         | DATETIME(6)  | NOT NULL                  |                        | 创建时间，UTC                |
| UNIQUE(video_project_id, photo_id) | \-           | \-                        | uk_video_photo         | 同一视频不可重复选择同一照片 |

# 7. 索引设计

| **表**               | **索引**                                                         | **用途**                              |
|----------------------|------------------------------------------------------------------|---------------------------------------|
| users                | UNIQUE(email)                                                    | 登录查找、账号唯一性                  |
| refresh_tokens       | UNIQUE(jti); (user_id, revoked_at)                               | Token 唯一性、按用户撤销/查活动 Token |
| places               | (name, city, area); (source_type, city)                          | 地点搜索与官方城市地点查询            |
| trips                | (user_id, start_date)                                            | 我的旅行列表                          |
| trip_places          | UNIQUE(trip_id,place_id); (trip_id,sort_order)                   | 防重复与旅行内排序                    |
| itinerary_items      | (trip_id,planned_date,planned_time)                              | 按日程时间轴读取                      |
| checkins             | (trip_id,checkin_time); (trip_id,place_id)                       | 时间轴与地点统计                      |
| photos               | (trip_id,captured_at); (trip_id,is_featured)                     | 相册时间排序与精选素材                |
| payments             | (trip_id,id); (provider_payment_id)                              | 最近支付与 Webhook 反查               |
| share_links          | UNIQUE(share_token); (trip_id,status)                            | Token 访问与旅行分享状态              |
| video_projects       | (trip_id,id); (status,id)                                        | 旅行视频列表与 Worker 队列            |
| video_project_photos | UNIQUE(video_project_id,photo_id); (video_project_id,sort_order) | 防重复选图与渲染顺序                  |

# 8. 外键与删除策略

| **子表字段**                          | **父表字段**       | **ON DELETE** | **设计含义**                                                   |
|---------------------------------------|--------------------|---------------|----------------------------------------------------------------|
| refresh_tokens.user_id                | users.id           | CASCADE       | 删除用户同步清理刷新令牌                                       |
| trips.user_id                         | users.id           | CASCADE       | 删除用户同步删除旅行及后续级联数据                             |
| trip_places.trip_id                   | trips.id           | CASCADE       | 删除旅行清理地点关联                                           |
| trip_places.place_id                  | places.id          | CASCADE       | 删除地点清理旅行关联                                           |
| itinerary_items.trip_id               | trips.id           | CASCADE       | 删除旅行清理行程                                               |
| itinerary_items.place_id              | places.id          | SET NULL      | 地点删除后保留行程文字/坐标信息                                |
| checkins.trip_id                      | trips.id           | CASCADE       | 删除旅行清理打卡                                               |
| checkins.place_id                     | places.id          | SET NULL      | 保留 place_name_snapshot 历史事实                              |
| checkins.itinerary_item_id            | itinerary_items.id | SET NULL      | 删除计划后保留打卡                                             |
| photos.checkin_id                     | checkins.id        | SET NULL      | 删除打卡后照片仍归旅行                                         |
| user_achievements.trip_id             | trips.id           | CASCADE       | 删除旅行清理旅行成就                                           |
| payments.trip_id                      | trips.id           | CASCADE       | 当前设计随旅行删除支付记录；生产运营阶段需再次评估财务留存要求 |
| share_links.trip_id                   | trips.id           | CASCADE       | 旅行删除后分享立即失效                                         |
| video_projects.trip_id                | trips.id           | CASCADE       | 旅行删除清理视频项目                                           |
| video_project_photos.video_project_id | video_projects.id  | CASCADE       | 项目删除清理选图关联                                           |
| video_project_photos.photo_id         | photos.id          | CASCADE       | 照片删除同步从视频项目移除                                     |

# 9. 东京官方种子数据

**V2\_\_seed_tokyo_and_achievements.sql 当前初始化：**

- 1 个官方城市：TOKYO / 东京 / JP / ACTIVE / TOKYO_WARM。

- 30 个东京 OFFICIAL 地点，覆盖浅草、秋叶原、上野、东京站、银座、涩谷、原宿、新宿、港区、台场等区域。

- 9 个初始成就：5 个 GLOBAL + 4 个 CITY(TOKYO)。

| **code**      | **名称**   | **类型** | **condition_type**     | **阈值** |
|---------------|------------|----------|------------------------|----------|
| FIRST         | 初次启程   | GLOBAL   | CHECKIN_COUNT          | 1        |
| PHOTO_STORY   | 旅行记录者 | GLOBAL   | PHOTO_COUNT            | 10       |
| EXPLORER      | 城市探索者 | GLOBAL   | AREA_COUNT             | 5        |
| COLLECTOR     | 足迹收藏家 | GLOBAL   | CHECKIN_COUNT          | 20       |
| TRIP_COMPLETE | 旅程完成   | GLOBAL   | TRIP_COMPLETED         | 1        |
| TOKYO_START   | 东京初心者 | CITY     | OFFICIAL_CHECKIN_COUNT | 1        |
| TRADITION     | 东京传统派 | CITY     | TOKYO_TRADITION        | 2        |
| NIGHT         | 东京夜行者 | CITY     | TOKYO_NIGHT            | 3        |
| TOKYO_MASTER  | 东京达人   | CITY     | OFFICIAL_CHECKIN_COUNT | 20       |

# 10. 数据一致性与业务校验

| **规则**       | **当前实现**                                                                             |
|----------------|------------------------------------------------------------------------------------------|
| 旅行归属       | 所有私有旅行 API 在服务层校验 trips.user_id == currentUser.id。                          |
| 自定义地点归属 | CUSTOM 地点只能在已关联它的旅行中使用；数据库本身未保存 owner_user_id。                  |
| Free 打卡限制  | FREE 旅行最多 10 个 checkins；由服务层在新增时校验。                                     |
| Free 照片限制  | FREE 旅行最多 10 张 photos；预签名与登记阶段都会检查。                                   |
| 照片文件合法性 | 仅 image/\*；当前单张上限 20MB；storage_key 必须属于当前 user/trip，且存储对象必须存在。 |
| 支付升级       | 仅后台确认 PAID 后更新 trips.plan_type=PRO；不依赖前端 success 页面。                    |
| 分享访问       | 只有 ACTIVE 且未过期的 share_token 可读取；撤销时记录 revoked_at。                       |
| 视频输入       | 至少 1 张照片；不能重复；MVP 9:16 / 30 秒；模板与音乐白名单由服务层校验。                |
| 时间处理       | 数据库事件时间写 UTC；Checkin API 根据用户 timezone 转为带偏移的时间返回。               |

# 11. 事务与并发注意事项

- 旅行创建、地点关联、行程转打卡、照片登记、成就发放、支付升级、视频项目变更等写操作应保持服务层事务边界。

- 成就使用 INSERT IGNORE + 唯一键 uk_user_trip_achievement，保证重复事件不会重复发放。

- 旅行地点使用 INSERT IGNORE + uk_trip_place，避免并发重复加入。

- 视频照片关联使用 uk_video_photo，避免同一照片在同一项目重复写入。

- 支付 Webhook 应保持幂等：已为 PAID 的记录再次收到事件时直接忽略。

- 分享 view_count 当前使用原子 UPDATE view_count=view_count+1；高访问量阶段再考虑异步统计。

# 12. Flyway 与版本管理

- V1\_\_initial_schema.sql：创建当前 15 张表及主外键、索引。

- V2\_\_seed_tokyo_and_achievements.sql：初始化东京官方城市、30 个官方地点和 9 个成就。

- 后续结构调整必须新增 V3、V4…… Migration，不修改已经进入共享/生产环境执行过的历史 Migration。

- 生产部署前先备份数据库，再执行 Flyway；Migration 失败不得绕过后手工改表。

# 13. 备份与恢复要求

- MySQL 至少每日备份，项目已有 scripts/mysql-backup.sh 作为基础脚本。

- 备份文件建议上传 R2，与业务图片存储隔离前缀或独立 Bucket。

- 建议保留策略：每日 7 天、每周 4 周、每月 6 个月（最终按运营合规要求调整）。

- 必须定期执行恢复演练：Backup → Restore → 启动 API → 验证关键数据与外键关系。

# 14. 当前设计中的已知约束

| **主题**        | **说明**                                                                                                                                   |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| CUSTOM 地点归属 | places 没有 owner_user_id / source_trip_id，归属依赖 trip_places 与服务层规则。若未来允许跨旅行复用个人地点，建议增加 ownership 模型。     |
| 官方城市关系    | official_cities 与 places/achievements 当前通过 city / city_code 逻辑关联，而不是外键。后续多语言和更多官方城市时可考虑 official_city_id。 |
| 状态完整性      | 多个 VARCHAR 状态字段没有 DB CHECK；合法值由 Java 服务层控制。                                                                             |
| 支付留存        | payments 对 trips 使用 ON DELETE CASCADE。正式商业运营前应根据会计/审计要求确认是否需要软删除旅行并长期保留支付记录。                      |
| 地点国际化      | places.name/description 当前单语；多语言阶段可引入 place_translations。                                                                    |
| 视频模板/音乐   | 当前由代码白名单管理，没有 video_templates / video_music 表；MVP 规模足够，运营化后再数据库化。                                            |

# 15. 后续扩展建议（非当前结构）

**以下内容为后续演进建议，不属于 Backend v4 当前已实现结构：**

- 多语言：place_translations / official_city_translations / achievement_translations。

- 个人地点库：为 CUSTOM Place 增加 owner_user_id 或独立 user_places，支持跨旅行复用。

- 视频配置运营化：video_templates、video_music 表，支持上下线、Pro 限制、版权信息。

- 软删除与审计：对 trips、photos、payments 等增加 deleted_at / audit_log，避免关键业务数据物理删除。

- 规模化统计：高访问量后，将分享访问量、视频任务队列等从强事务表拆分到更适合的统计/队列设施。

# 附录 A：数据库对象清单

| **类型**  | **名称/文件**                         | **说明**               |
|-----------|---------------------------------------|------------------------|
| Migration | V1\_\_initial_schema.sql              | 当前物理表结构         |
| Seed      | V2\_\_seed_tokyo_and_achievements.sql | 东京官方地点与初始成就 |
| Database  | tabitrace                             | 建议业务库名称         |
| Charset   | utf8mb4                               | 支持中文、日文、Emoji  |
| Collation | utf8mb4_0900_ai_ci                    | 当前 DDL 默认排序规则  |
| Engine    | InnoDB                                | 事务与外键支持         |

# 附录 B：设计书基线声明

**本文件根据以下当前项目事实生成：**

- TabiTrace Backend v4：api/src/main/resources/db/migration/V1\_\_initial_schema.sql

- TabiTrace Backend v4：api/src/main/resources/db/migration/V2\_\_seed_tokyo_and_achievements.sql

- Backend v4 当前 Entity / MyBatis Mapper / Service 中对状态、权限、统计与校验的实际使用方式。

**若后续代码和 Flyway Migration 发生变化，应同步提升本设计书版本。**
