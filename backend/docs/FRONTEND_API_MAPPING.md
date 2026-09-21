# Frontend v4 Warm Workspace → Backend v5 API Mapping

| 前端功能 | API |
|---|---|
| 注册 | `POST /api/v1/auth/register` |
| 登录 | `POST /api/v1/auth/login` |
| 我的旅行 | `GET /api/v1/trips` |
| 创建旅行 | `POST /api/v1/trips` |
| 东京官方探索 | `GET /api/v1/official-cities/TOKYO` |
| 搜索官方地点 | `GET /api/v1/places/search?q=...` |
| 加入已有地点 | `POST /api/v1/trips/{tripId}/places` |
| 加入官方地点 | `POST /api/v1/trips/{tripId}/official-places/{placeId}` |
| 当前旅行地点 | `GET /api/v1/trips/{tripId}/places` |
| 手动自定义地点 | `POST /api/v1/trips/{tripId}/places/custom` |
| 手动输入行程 | `POST /api/v1/trips/{tripId}/itinerary` |
| 行程列表 | `GET /api/v1/trips/{tripId}/itinerary` |
| 行程转打卡 | `POST /api/v1/trips/{tripId}/itinerary/{itemId}/checkin` |
| 直接打卡 | `POST /api/v1/trips/{tripId}/checkins` |
| 时间轴 | `GET /api/v1/trips/{tripId}/timeline` |
| 照片上传授权 | `POST /api/v1/trips/{tripId}/photos/presign` |
| 保存照片记录 | `POST /api/v1/trips/{tripId}/photos` |
| 相册 | `GET /api/v1/trips/{tripId}/photos` |
| 精选素材 | `POST/DELETE /api/v1/photos/{id}/feature` |
| 成就 | `GET /api/v1/trips/{tripId}/achievements` |
| 旅行总结 | `GET /api/v1/trips/{tripId}/summary` |
| 完成旅行 | `POST /api/v1/trips/{tripId}/complete` |
| 归档旅行（只读，释放 FREE 名额） | `POST /api/v1/trips/{tripId}/archive` |
| 取消归档（恢复为 COMPLETED） | `POST /api/v1/trips/{tripId}/unarchive` |
| 创建 UNLISTED 分享 | `POST /api/v1/trips/{tripId}/share-links` |
| 分享管理 | `GET/DELETE /api/v1/trips/{tripId}/share-links...` |
| 公开分享访问 | `GET /api/v1/share/{token}` |
| Trip Pro Checkout | `POST /api/v1/trips/{tripId}/payments/checkout` |
| 视频草稿 | `POST /api/v1/trips/{tripId}/video-projects` |
| 视频状态 | `GET /api/v1/video-projects/{id}` |
| 开始视频生成 | `POST /api/v1/video-projects/{id}/render` |

旅行海报、九图故事、每日长图仍由前端 `html-to-image` 生成 PNG，后端负责提供数据、权限和分享链接。
