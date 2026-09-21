# Implementation Status

## 已真实实现

- MySQL/Flyway 数据模型
- Spring Security/JWT/BCrypt
- REST CRUD 与所有权校验
- FREE / PRO 业务限制
- 时间轴聚合
- 成就计算
- Summary 聚合
- UNLISTED 分享 token
- R2 Presigned PUT 实现
- Stripe Checkout REST 调用与 Webhook HMAC 校验
- Video Project DB Queue
- FFmpeg Worker 基础照片视频输出

## 本地 Mock 默认开启

- R2：避免联调必须配置云账号
- Payment：Checkout 直接模拟成功
- Video：API 内定时器模拟渲染进度

## 设计书中仍属于后续外部选型/增强的部分

- 全球 Geocoding Provider：设计书未最终选定供应商，因此 `/places/search` 当前搜索本地官方/已保存地点；未擅自绑定 Google/Mapbox/Geoapify。
- 视频的高级地图动画/文字/成就动画：数据字段与队列已准备，基础 Worker 使用 FFmpeg 生成照片视频；可后续替换为 Remotion + FFmpeg。
- 商用 BGM 文件：代码支持 Worker 从配置目录加载 `<musicCode>.mp3`，但项目不内置任何版权音乐文件。
- 图片浏览器端压缩/WebP：属于 Next.js 前端职责，后端负责 MIME/大小与元数据。
