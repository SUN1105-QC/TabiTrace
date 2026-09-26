# 《Travel Story 完善报告》

> 日期：2026-09-21　范围：`/trips/{id}/video` 旅行视频（前端 + API + video-worker + 数据库）
> 状态：代码已完成并在本地验证，**尚未提交到 GitHub**（按约定等确认后再推送）

---

## 1. 改造前的现状与差距

### 1.1 原本已经有的

| 层 | 能力 |
|---|---|
| API | 创建 / 列表 / 详情 / 更新草稿 / 开始生成 / 删除；校验旅行归属与照片归属；模板 3 选 1、FREE 不能用 City、照片 FREE 10 / PRO 30 |
| 数据库 | `video_projects`、`video_project_photos` 两张表 |
| Worker | 下载照片 → 缩放到 720p / 1080p → FREE 加水印 → 等时长轮播 → 混入音乐 |
| 前端 | 模板按钮、音乐试听、3 个开关、照片勾选、静态预览卡、进度条与播放器 |

### 1.2 与目标相比缺失的（本次补齐）

- **数据库里没有 `video_templates` / `video_music`**：指令里当作「已有」，实际不存在，前后端各写死一份列表
- Worker **完全忽略模板、文字、地图、成就开关**，成片只是照片轮播，没有开场、地图、结尾，也没有转场
- 只支持 30 秒；没有清晰度字段，FREE 请求 1080p 无从拦截；PRO 音乐 / 完整路线等规则都不存在
- 没有分镜概念，预览与成片不是同一套数据
- 生成状态只有百分比；失败只有一段原始报错；没有「复制版本」「重新生成已完成视频」
- 本地配置把模拟渲染器写死为开启，真实 Worker 永远抢不到任务（上一轮已修）
- **打卡表没有天气字段**：「显示天气」没有数据来源（见 §5）

---

## 2. 已完成

### P0 核心链路

- **V3 迁移**：`video_projects` 新增 `name / quality / cover_photo_id / settings_json / storyboard_json / render_stage / renderer / error_code`；新建 `video_templates`、`video_music` 并写入种子数据；按旅行套餐回填清晰度，区分历史 MOCK / FFMPEG 产物
- **分镜服务 `StoryboardService`**：按真实打卡时间自动编排「开场 → 地图路线 → 地点段（同一打卡的相邻照片合一段）→ 成就 → 结尾」，按模板节奏分配时长，**总时长严格等于所选时长**；缺数据自动跳过并给出提示
- **分镜冻结**：点「开始生成」时把分镜写入 `storyboard_json`，Worker 只按它渲染——预览与成片是同一份数据
- **FREE / PRO 规则全部在后端**（前端只是提前提示）：见 §3.3
- **Worker 重写**：Java2D 按模板画开场 / 地点字幕 / 地图路线 / 成就 / 结尾帧，FFmpeg `xfade` 链做转场，混音带淡入淡出，`+faststart` 便于网页边下边播；分阶段写入 `render_stage`；失败按阶段写入 `error_code`
- **隐私修复**：Worker 工作目录位于 `public/` 下，过去原始照片会一直留在可公开访问的目录；现在导出成功后只保留 `output.mp4`

### P1 产品体验

- 四步流程页面：① 选择风格 ② 选择内容 ③ 视频设置 ④ 分镜与生成；PC 左 55% 配置 / 右 45% 预览（sticky）
- ✨ 自动帮我生成：一键套用 Journal + 自动挑选照片（按时间）+ Warm Journey + 全部内容 + 30 秒 9:16，直接出预览
- 照片素材：全部 / 精选 / 按日期筛选，选择、取消、设为封面、移除、查看大图（灯箱，可键盘关闭），拖动或箭头排序
- 自动挑选：精选优先 → 不同打卡轮流选 → 连拍去重 → 按时间排序（确定性规则，无随机数）
- 故事内容：9 个开关 + 自定义标题 + 自定义结束语 + 地图模式（关闭 / 简洁 / 完整路线）
- 音乐：列表来自后端，分类筛选，单曲试听（同时只放一首，再点停止），FREE / PRO 标识
- 视频设置：9:16 可用，4:5 / 16:9 明确标 Coming Soon 且不可点；15 / 30 / 60 秒；720p / 1080p
- 分镜编辑：调整中间段落顺序（拖动 / 上下箭头）、关闭某段、改标题；开场结尾固定。不提供逐帧、音轨、关键帧
- 9:16 预览：按分镜逐段播放，三种模板各自的版式与转场，地图路线随时间延伸；设置变化后提示「设置已变化，请重新生成预览」
- 分阶段生成状态：✓ 正在准备素材 ✓ 正在生成地图动画 ● 正在生成旅行故事 ○ 正在合成音乐 ○ 正在导出 MP4 + 百分比，全部来自后端轮询
- 完成态：「Travel Story 已生成 🎉」+ 播放器 + 播放 / 下载 MP4 / 新窗口打开 / 分享 / 重新生成 / 编辑设置 + 模板、照片数量、时长、比例、分辨率、生成时间
- 失败态：「生成失败 · 音乐不可用」这类友好标题 + 可展开的原因 + 重试 / 返回编辑 / 删除项目
- 我的视频：同一旅行多个版本，按状态给出不同操作（草稿：继续编辑 / 删除；排队：查看状态；生成中：查看进度；完成：播放 / 下载 / 分享 / 重新编辑 / 复制版本 / 删除；失败：查看错误 / 重新生成 / 删除）
- Loading / Empty / Error / Processing / Failed / Success 六种状态齐全
- 移动端单栏：预览 → 风格 → 照片 → 故事内容 → 音乐 → 视频设置 → 生成；模板卡片横向滑动；无页面横向滚动

### P2 增强

- 模板卡片「10 秒预览」：用当前分镜抽取开场、地图、两个地点、结尾，按所选模板风格播放 10 秒后自动回到自己的分镜
- 分镜提示：照片太多 / 太少、转场被压缩、坐标不足、没有成就、没有天气等都会明确告知
- 后端单元测试 `StoryboardServiceTest`（5 个用例）
- 历史项目缺名称时按「旅行标题 · 模板」显示

---

## 3. 修改文件与新增接口

### 3.1 文件

**后端 API**（`backend/api/src/main/…`）
- 新增：`db/migration/V3__travel_story.sql`、`video/service/StoryboardService.java`、`video/mapper/VideoCatalogMapper.java`、`video/entity/VideoTemplateEntity.java`、`video/entity/VideoMusicEntity.java`
- 修改：`video/dto/VideoDtos.java`、`video/service/VideoService.java`、`video/service/VideoMockRenderer.java`、`video/controller/VideoController.java`、`video/mapper/VideoProjectMapper.java`、`video/entity/VideoProjectEntity.java`
- 测试：`src/test/java/com/tabitrace/video/StoryboardServiceTest.java`

**Video Worker**（`backend/video-worker/…`）
- 新增：`ScenePainter.java`（Java2D 画面）、`RenderFailure.java`（带错误码的失败）
- 重写：`FfmpegRenderer.java`、`VideoJobPoller.java`、`VideoJob.java`；`pom.xml` 增加 `jackson-databind`

**前端**（`frontend/…`）
- 新增：`types/video.ts`、`services/video.ts`、`utils/video-status.ts`、`utils/video-autoselect.ts`
- 新增组件 `components/video/`：`VideoTemplateSelector`、`VideoPhotoSelector`、`VideoAutoSelect`、`VideoStorySettings`、`VideoMusicSelector`、`VideoSettings`、`VideoStoryboard`、`VideoPreview`、`VideoRenderProgress`、`VideoProjectStatus`、`VideoProjectCard`、`VideoProjectHistory`、`VideoGenerateButton`、`VideoProGate`
- 重写：`app/trips/[id]/video/page.tsx`；`app/globals.css` 新增 Travel Story 样式并移除旧的 `.video-*` 样式
- 删除（被取代）：`components/video/MusicPicker.tsx`、`components/video/VideoResultPanel.tsx`

### 3.2 接口（沿用原有，只补缺失的）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/video-templates` | **新增**，模板目录 |
| GET | `/video-music` | **新增**，音乐目录 |
| POST | `/trips/{tripId}/video-storyboard` | **新增**，未保存设置的分镜预览 |
| GET | `/video-projects/{id}/storyboard` | **新增**，已生成项目返回冻结分镜 |
| POST | `/video-projects/{id}/duplicate` | **新增**，复制为新草稿 |
| POST | `/trips/{tripId}/video-projects` | 原有，请求体新增 `quality / coverPhotoId / settings` |
| PUT | `/video-projects/{id}` | 原有，仅草稿可改（照片、模板、音乐、内容设置都走它） |
| POST | `/video-projects/{id}/render` | 原有，现在也覆盖「失败重试」和「已完成后重新生成」 |
| GET / DELETE | `/video-projects/{id}`、`/trips/{tripId}/video-projects` | 原有 |

旧字段 `showText / showMap / showAchievements` 继续接收并与 `settings` 双向同步，旧客户端不受影响。

### 3.3 FREE / PRO 后端规则

| 规则 | FREE | PRO | 违规返回 |
|---|---|---|---|
| 模板 | 仅 Journal | 全部 | 403 `PRO_TEMPLATE_REQUIRED` |
| 照片数 | ≤ 10 | ≤ 30 | 403 `PRO_PHOTO_LIMIT` |
| 时长 | 15 / 30 秒 | + 60 秒 | 403 `PRO_DURATION_REQUIRED` |
| 清晰度 | 720p + 水印 | 1080p 无水印 | 403 `PRO_QUALITY_REQUIRED` |
| 音乐 | 基础 3 首 | 全部 | 403 `PRO_MUSIC_REQUIRED` |
| 地图 | 关闭 / 简洁 | + 完整路线 | 403 `PRO_MAP_REQUIRED` |

所有接口另外校验：登录、旅行归属、照片归属（403 `VIDEO_PHOTO_INVALID`）、照片已删除、封面必须在所选照片中、模板 / 音乐是否可用、比例（4:5、16:9 返回 `VIDEO_RATIO_COMING_SOON`）、项目归属（403 `VIDEO_FORBIDDEN`）、项目已删除（404）、排队中重复生成（409）、草稿以外不能修改（409）。「开始生成」时还会按当前数据**重新校验一遍**。

> ⚠️ 行为变化：过去 FREE 旅行可以用「极简杂志」模板，按指令 §21 现在只有 Journal 是 FREE。已存在的旧项目不受影响，但不能再以 FREE 身份重新生成。

---

## 4. 仍使用 Mock / 占位的部分

| 项 | 现状 |
|---|---|
| **背景音乐** | `frontend/public/music/*.wav` 是合成的占位音轨，可听但谈不上好听。换成正版 `.mp3` 同名放入即可，代码不用改；换完请同步更新 `video_music.duration_seconds` |
| **本地模拟渲染器** | `local` profile 默认仍开启（`VIDEO_MOCK_RENDERER=true`），只推进状态、不出片；界面明确标注「Local Mock Renderer」且不显示播放器。`.claude/launch.json` 启动的 API 已关闭它 |
| **自动挑选照片** | 规则策略（精选、地点分散、连拍去重、时间排序），不是 AI。按钮写作「自动挑选」而非「AI 自动挑选」，避免误导；策略集中在 `utils/video-autoselect.ts`，以后可替换 |
| **分享** | 使用浏览器系统分享（不支持时复制 MP4 链接），没有专门的视频分享落地页 |

## 5. 需要第三方服务的功能

| 功能 | 需要什么 |
|---|---|
| 天气 | 打卡时调用天气服务（如 Open-Meteo / 和风天气）并给 `checkins` 增加天气字段。目前「显示天气」会被分镜自动跳过并提示 |
| 真实底图 | 现在的地图段是按经纬度投影的路线示意图（无底图瓦片）。要带真实地图需接瓦片 / 静态地图服务（Mapbox、MapTiler 等），并注意版权署名 |
| 真正的 AI 选图 | 需要视觉模型打分（清晰度、人物 / 风景、相似度） |
| 云存储 | R2 模式代码未改动，但本次没有真实 R2 凭据可测 |
| 生产环境字体 | Linux 服务器需安装中文字体（如 Noto Sans / Serif CJK），否则视频中的中文会变成方块 |

## 6. 未完成项与已知限制

- **4:5 / 16:9** 未实现，界面标 Coming Soon、后端拒绝
- ~~Worker 崩溃恢复~~ → **已在第二轮修正中完成**（见 §9）
- Worker 一次只处理一个任务（`LIMIT 1` 串行）；多人同时生成需要排队（界面超过 1 分钟会提示）。启动清扫假设单实例，多实例部署需为每个实例配置独立工作目录
- 每个模板只有一种转场，没有 Ken Burns 推拉镜头
- ~~地点很密集时，地图上的序号可能重叠~~ → **已修正**（见 §9）
- 「自动帮我生成」最多挑 12 张（30 秒内每张约 2 秒），不是套餐上限；需要更多可以手动加选
- ~~照片 EXIF 方向~~ → **更正：这不是问题**。实测 FFmpeg 9 解码时已按 EXIF 方向自动旋转，Worker 所有照片都经过 FFmpeg 解码（见 §9）

---

## 7. 测试结果

**后端端到端（真实 API + MySQL + FFmpeg Worker）：75 / 75 通过**

| 类别 | 结果 |
|---|---|
| 目录 | 模板 3 个仅 Journal 为 FREE；音乐 6 首带分类；未登录 401 |
| FREE 权限 | 11 张 / MINIMAL / CITY / 1080p / 60 秒 / PRO 音乐 / 完整路线 → 均 403；45 秒、4:5、封面不在所选、他人照片、重复照片、不存在模板均被拒；预览接口同样拦截 |
| 分镜 | 结构开场 → 地图 → 地点 → 结尾；总时长 = 30.00 秒；地图按打卡时间排序；打卡文字、结束语、统计正确；无天气提示；段落重排 / 关闭 / 改标题生效且仍为 30 秒 |
| FREE 生成 | 3 张照片 → 改顺序 → 设封面 → 生成 → 409 防重复 → COMPLETED（FFMPEG）；成片 **720×1280 / 30 秒 / 有音轨**；公开目录只剩 `output.mp4` |
| 版本 | 复制版本、多版本列表、他人读取 / 删除 403、删除后 404 |
| 失败重试 | 移走音乐文件 → FAILED `MUSIC_UNAVAILABLE`；恢复后重试 → COMPLETED；15 秒版时长 15 秒 |
| PRO | City / 60 秒 / 1080p / 完整路线 / 11 张 → 成片 **1080×1920 / 60 秒 / 有音轨 / 无水印** |

**后端单元测试：19 / 19 通过**（含新增 `StoryboardServiceTest` 5 个）

**前端**：`tsc --noEmit` 通过、`npm run build` 通过；浏览器实测自动生成 → 生成 → 分阶段状态 → 播放器、四项 PRO 行内提示、照片与分镜排序、失败 → 重试、复制 / 继续编辑 / 删除、10 秒模板预览、PRO 旅行解锁；移动端 390px 顺序正确且无横向滚动；首页、我的旅程、分享、照片等页面回归无报错。

**成片抽帧人工检查**：开场标题与日期、地图路线（完整模式逐站延伸）、地点字幕与打卡文字、结尾天数与统计、FREE 水印均正确渲染中文。

---

## 8. 本地测试步骤

```bash
# 1. 后端（启动时 Flyway 自动执行 V3；关闭模拟渲染器）
mvn -f backend/pom.xml -pl api spring-boot:run -Dspring-boot.run.arguments=--app.video.mock-renderer-enabled=false

# 2. 视频 Worker（需要已安装 FFmpeg；不在 PATH 时另设 FFMPEG_BINARY）
STORAGE_MODE=local mvn -f backend/pom.xml -pl video-worker spring-boot:run

# 3. 前端
cd frontend && npm run dev

# 4. 后端单元测试
mvn -f backend/pom.xml -pl api test
```

然后打开 `http://localhost:3000/trips/{旅行ID}/video`：

1. 点「✨ 自动帮我生成」→ 右侧出现 9:16 预览 → 点「生成旅行视频」→ 看分阶段进度 → 完成后播放
2. 在「选择风格」点 PRO 模板（FREE 旅行应只提示不切换）、点「10 秒预览」
3. 调整照片顺序、设封面、关闭某个分镜段落 → 预览提示过期 → 「重新预览」
4. 在「我的视频」试复制版本、继续编辑、删除
5. 失败演示：临时把 `frontend/public/music/CITY_WALK.wav` 改名，用 City Walk 生成 → 失败 → 改回文件名 → 点「重试」

本地测试数据：测试账号下新建了 FREE 旅行「东京三日散步」（ID 18，回归测试每次会重建，10 张东京实景照片、3 个带坐标打卡），PRO 旅行 ID 11 也新增了几个视频版本。渲染出的视频位于 `frontend/public/generated-videos/`（已被 `.gitignore` 排除）。

---

## 9. 第二轮修正（2026-09-21）

按上一版 §6 的建议继续修正，全部不涉及业务规则变化。

| 问题 | 修正 | 实测 |
|---|---|---|
| **Worker 崩溃后任务永远卡在「生成中」**（systemd 会重启 Worker，但新进程只拾取 QUEUED） | Worker 处理期间每 15 秒写心跳；API 新增 `VideoRenderWatchdog`，每分钟把超过 300 秒无心跳的 PROCESSING 任务标为 FAILED / `RENDER_INTERRUPTED`（放在 API 里，因为出事时 Worker 可能不在）；Worker 写最终状态时要求仍是 PROCESSING，被回收的任务不会被「复活」 | 渲染中强杀 Worker → 任务卡住（复现）→ 看门狗标记「生成中断」→ 界面显示中断原因与「重试」→ 重启 Worker 后点重试成功出片 |
| **FFmpeg 卡死时心跳会一直续命** | 每次 FFmpeg 调用加硬超时（默认 600 秒），输出改写临时日志以便超时强杀 | 3 秒超时下渲染 60 秒 1080p → 「视频合成失败：ffmpeg 超过 3 秒没有完成，已强制结束」 |
| **失败 / 被强杀时原始照片留在公开目录**（新发现） | 失败时整目录清空；Worker 启动时先清扫遗留中间文件，且只保留「已完成」项目的成片（强杀时写了一半的残缺 MP4 也会删除） | 启动清扫实际清掉 17 + 47 个遗留文件；回归后公开目录非成片文件 0 个 |
| **Windows 上被强杀进程短暂锁文件**（测试中新发现）：清理异常覆盖了真实错误，并中断清理留下原始照片 | 清理改为逐个文件尽力删除 + 短暂重试，清理失败绝不掩盖真实错误 | 同上超时用例：错误信息正确、目录清空 |
| **地图地点密集时标签 / 序号重叠** | 先画标记后摆标签，标签按右 / 左 / 上 / 下寻找空位；几乎重合的站点把序号扇形错开并用短线连回真实位置 | 旅行 11 的 10 个地点全部带标签且互不重叠 |
| **Linux 服务器缺中文字体时中文静默变方块** | Worker 启动自检：FFmpeg 可用性、字体能否显示中文、音乐目录；缺字体打 WARN 并给出 `sudo apt install fonts-noto-cjk` | 本机日志：`sans=Microsoft YaHei UI, serif=Noto Serif SC` |
| **没有 Worker 时任务一直排队、用户不知原因** | 排队超过 1 分钟时界面提示（说明可能在排队，或渲染服务未运行） | Worker 停止时排队任务出现提示；Worker 启动后该任务自动完成 |
| EXIF 方向 | **无需修改**（上一版误列） | 构造 Orientation=6 的照片，FFmpeg 输出 360×495 且方向正确 |

新增 / 修改文件：
- API：`video/service/VideoRenderWatchdog.java`（新）、`video/mapper/VideoProjectMapper.java`（新增 `failStale`）、`application.yml`（超时配置）
- Worker：`VideoJobPoller.java`（心跳、启动清扫、状态守卫）、`FfmpegRenderer.java`（FFmpeg 超时、逐个文件清理）、`ScenePainter.java`（标签避让、字体自检）、`WorkerStartupCheck.java`（新）
- 前端：`components/video/VideoRenderProgress.tsx`（排队过久提示）、`utils/video-status.ts`（`RENDER_INTERRUPTED` 文案）
- 文档：`backend/README.md`（可靠性与生产部署）、`backend/.env.example`（新配置项）

新配置项：`VIDEO_PROCESSING_TIMEOUT_SECONDS`（API，默认 300）、`WORKER_FFMPEG_TIMEOUT_SECONDS`（默认 600）、`WORKER_HEARTBEAT_SECONDS`（默认 15）。

回归：端到端 75 / 75、单元测试 19 / 19、前端类型检查与生产构建通过。
