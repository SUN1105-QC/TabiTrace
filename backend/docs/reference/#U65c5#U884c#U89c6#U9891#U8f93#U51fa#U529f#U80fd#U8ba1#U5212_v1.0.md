# TabiTrace 旅行视频输出功能计划 v1.0

## 1. 功能定位

新增功能名称：

# 旅行视频 / Travel Story

核心目标：

> 自动把一次旅行中的地点、照片、地图、路线、日期、统计数据和旅行文字，生成一段适合保存与分享的旅行回顾视频。

用户不需要自己剪辑。

只需要：

```text
完成旅行
↓
选择照片
↓
选择视频模板
↓
点击生成
↓
得到旅行视频
```

---

# 2. 为什么要做视频输出

TabiTrace 原本的旅行成果主要是：

```text
旅行地图
+
照片
+
数据统计
+
成就
+
旅行纪念卡
```

视频输出的作用是把这些内容进一步组合成：

```text
可以直接发布到
小红书
抖音
朋友圈
Instagram
TikTok
的视频内容
```

这样视频同时承担两个作用：

## 对用户

获得更有纪念价值的旅行成果。

## 对平台

用户发布视频时自然传播：

```text
TabiTrace
```

品牌。

---

# 3. 核心用户流程

完整流程：

```text
我的旅行
↓
旅行结束
↓
生成旅行回顾
↓
选择
「生成旅行视频」
↓
选择视频模板
↓
选择照片
↓
选择音乐
↓
预览
↓
生成
↓
下载 MP4
↓
分享到社交平台
```

---

# 4. 入口设计

在：

```text
我的旅迹
```

页面加入：

```text
生成旅行成果
```

下面提供：

```text
[ 生成旅行卡 ]

[ 生成旅行视频 ]
```

最终可以形成：

```text
旅行成果

├── 分享卡
│
└── 旅行视频
```

---

# 5. 视频内容组成

一个标准旅行视频建议包含：

## ① 开场

例如：

```text
TOKYO
2026

MY TOKYO JOURNEY

2026.04.28 — 05.03
```

时长：

```text
2～3 秒
```

---

## ② 旅行地图

地图缩放到东京。

出现：

```text
浅草
秋叶原
东京塔
涩谷
新宿
```

并逐渐连接路线。

示例：

```text
浅草
  ↓
秋叶原
  ↓
东京站
  ↓
东京塔
  ↓
涩谷
```

---

# 6. 地点章节

每个地点形成一个小章节。

例如：

```text
DAY 01

浅草 · Asakusa
```

↓

显示：

```text
浅草寺照片
雷门照片
街景照片
```

↓

进入：

```text
DAY 02

秋叶原
```

---

# 7. 图片展示

每个地点选择：

```text
1～5 张照片
```

效果可以使用：

```text
淡入

缩放

横移

轻微 Ken Burns

照片叠加

拍立得样式
```

不要做复杂炫酷转场。

整体保持：

> 旅行纪录片 / 旅行杂志感。

---

# 8. 地点信息

画面角落可以显示：

```text
📍 浅草寺

Tokyo · Asakusa

DAY 01
```

或者：

```text
01
浅草寺
SENSO-JI
```

保持非常简洁。

---

# 9. 用户旅行文字

如果用户在打卡时写了：

```text
今天虽然游客很多，
但晚上的浅草真的很漂亮。
```

视频中可以作为字幕出现：

```text
“今天虽然游客很多，
但晚上的浅草真的很漂亮。”
```

这样可以明显增强：

> 个人故事感。

---

# 10. 旅行统计章节

视频后半部分显示：

```text
6 DAYS

12 PLACES

36 PHOTOS

5 AREAS

42 KM
```

如果是东京官方旅行：

```text
TOKYO EXPLORED

40%
```

---

# 11. 成就章节

例如：

```text
ACHIEVEMENTS

🏮 东京传统派

🌃 东京夜行者

🏆 东京探索者
```

可以设计为：

```text
旅行印章逐个盖下
```

的动画。

---

# 12. 结尾

结尾示例：

```text
TOKYO
2026

12 places.
6 days.
One journey.
```

最后：

```text
Made with

旅迹 TabiTrace
```

免费版：

```text
TabiTrace Logo
```

必须保留。

Pro：

可以：

```text
去除品牌水印
```

---

# 13. 视频模板

首版不要提供几十种模板。

MVP 先做：

# 3 种

---

## Template 01

### JOURNAL

风格：

```text
旅行日记

米白

纸张

照片

手写感
```

适合：

```text
情侣
朋友
日常旅行
```

---

## Template 02

### MINIMAL

风格：

```text
极简

白色

黑色文字

大照片

地图
```

类似：

```text
Apple
+
旅行杂志
```

适合：

```text
城市旅行
建筑
摄影
```

---

## Template 03

### CITY

风格：

```text
城市感

大标题

地图

路线

快速节奏
```

例如东京：

```text
TOKYO
35.6762° N
139.6503° E
```

适合：

```text
小红书
抖音
Instagram
```

---

# 14. 视频比例

这是非常重要的。

首版至少支持：

## 9:16

```text
1080 × 1920
```

用于：

```text
小红书

抖音

TikTok

Instagram Reels
```

这是首版最重要比例。

---

## 后期增加 16:9

```text
1920 × 1080
```

适合：

```text
YouTube

电视

电脑
```

---

## 后期增加 1:1

```text
1080 × 1080
```

社交媒体。

---

# 15. 视频长度

建议三个档位。

## Short

```text
15 秒
```

特点：

```text
3～5 个地点
快速回顾
```

适合社交传播。

---

## Standard

```text
30 秒
```

作为默认。

包含：

```text
地图
地点
照片
统计
成就
```

---

## Story

```text
60 秒
```

用于：

```text
完整旅行回顾
```

第一版推荐只开发：

```text
30 秒
```

降低复杂度。

---

# 16. 照片选择

系统可以默认：

```text
自动选择
```

例如：

```text
每个地点自动选 1～2 张照片
```

用户可以调整：

```text
✓ 浅草寺 01
✓ 浅草寺 02
□ 雷门 03
✓ 秋叶原 01
```

支持：

```text
拖拽调整顺序
```

---

# 17. 自动排序

默认根据：

```text
旅行日期
↓
打卡时间
↓
地点顺序
```

生成视频。

例如：

```text
DAY 1

浅草
↓
秋叶原

DAY 2

东京站
↓
银座

DAY 3

东京塔
↓
涩谷
```

---

# 18. 音乐

首版必须谨慎处理版权。

不要直接允许使用：

```text
商业流行歌曲
```

建议采用：

```text
平台提供可商用 BGM
```

第一版提供：

```text
3～5 首
```

例如：

```text
Warm Journey

Tokyo Night

Slow Morning

City Walk

Memories
```

---

# 19. 音乐选项

用户可以：

```text
无音乐

Warm

City

Chill

Emotional
```

后期再增加：

```text
上传自己的音乐
```

但需要版权和文件管理设计。

---

# 20. 视频编辑页

页面建议：

```text
← 返回

旅行视频

[ 预览画面 ]

模板
Journal / Minimal / City

比例
9:16

长度
30 秒

照片
12 张

音乐
City Walk

旅行文字
ON

地图动画
ON

成就
ON

[ 生成视频 ]
```

---

# 21. 简单编辑能力

首版只允许：

```text
选择模板

选择照片

调整照片顺序

选择音乐

显示 / 隐藏旅行文字

显示 / 隐藏地图

显示 / 隐藏成就
```

不要第一版做：

```text
时间轴剪辑

自由字幕

滤镜

视频裁剪

复杂转场编辑

多轨音频
```

否则会逐渐变成：

> 剪映。

这不是 TabiTrace 的目标。

---

# 22. 产品核心原则

TabiTrace 的视频功能应该是：

> 自动生成。

不是：

> 视频编辑器。

用户应该最多：

```text
3～5 个操作
```

就能生成视频。

---

# 23. MVP 视频生成流程

第一版：

```text
选择旅行
↓
选择模板
↓
选择照片
↓
选择音乐
↓
生成
```

结束。

---

# 24. 前端需要的数据

Frontend 获取：

```json
{
  "trip": {
    "title": "我的东京旅行",
    "startDate": "2026-04-28",
    "endDate": "2026-05-03"
  },

  "stats": {
    "days": 6,
    "places": 12,
    "photos": 36,
    "exploreRate": 40
  },

  "places": [],

  "photos": [],

  "achievements": []
}
```

---

# 25. 新增数据表

建议新增：

```text
video_projects
```

---

# 26. video_projects

```text
id BIGINT PK

user_id BIGINT

trip_id BIGINT

template_code VARCHAR(50)

aspect_ratio VARCHAR(20)

duration INT

music_code VARCHAR(50)

status VARCHAR(30)

progress INT

output_key VARCHAR(500)

output_url VARCHAR(1000)

error_message TEXT NULL

created_at DATETIME

updated_at DATETIME

completed_at DATETIME NULL
```

---

# 27. Video Status

状态：

```text
DRAFT

QUEUED

PROCESSING

COMPLETED

FAILED
```

例如：

```text
PROCESSING
65%
```

---

# 28. 视频照片关系

增加：

```text
video_project_photos
```

字段：

```text
id

video_project_id

photo_id

sort_order

duration

created_at
```

---

# 29. 音乐表

可以增加：

```text
video_music
```

字段：

```text
id

code

name

file_url

duration

license_type

active
```

---

# 30. 视频模板表

```text
video_templates
```

字段：

```text
id

code

name

description

thumbnail_url

aspect_ratio

duration

pro_only

active
```

例如：

```text
JOURNAL

MINIMAL

CITY
```

---

# 31. 技术实现方向

视频生成不建议在：

```text
浏览器
```

完整完成。

正式产品建议：

```text
Frontend
↓
Spring Boot
↓
Video Render Worker
↓
生成 MP4
↓
Cloudflare R2
```

---

# 32. 推荐架构

```text
用户
 │
 ▼
Next.js

 │
 POST /video-projects
 ▼

Spring Boot
 │
 │ 创建视频任务
 ▼

MySQL

 │

 ▼

Video Render Worker

 │
 ├── 读取照片
 ├── 读取地图截图
 ├── 添加文字
 ├── 添加动画
 ├── 添加音乐
 │
 ▼

FFmpeg

 │
 ▼

MP4

 │
 ▼

Cloudflare R2
```

---

# 33. Video Worker

建议视频生成单独设计：

```text
video-worker
```

不要长期直接放在：

```text
Spring Boot Web API
```

进程中渲染。

因为视频渲染：

```text
CPU 高

内存高

时间长
```

会影响普通 API。

---

# 34. 第一阶段可以简化

MVP 用户很少时，可以暂时：

```text
Lightsail

├── Next.js
├── Spring Boot
├── MySQL
└── Video Worker
```

全部同一台服务器。

但逻辑上：

```text
Video Worker
```

独立。

方便以后拆出去。

---

# 35. 视频生成技术

推荐核心：

# FFmpeg

作用：

```text
图片转视频

合成音乐

添加字幕

调整尺寸

转场

编码

导出 MP4
```

---

# 36. 视频生成方案

推荐：

```text
HTML / CSS
+
Browser Render
+
FFmpeg
```

或者：

```text
Node Video Renderer
+
FFmpeg
```

长期可以考虑：

```text
Remotion
```

这类 React 驱动的视频生成方案。

---

# 37. 推荐 TabiTrace 方案

前期可以：

```text
Remotion
+
FFmpeg
```

负责：

```text
地图动画

文字

照片

统计数字

成就

模板
```

Spring Boot 继续负责：

```text
业务

认证

权限

数据

任务创建
```

视频 Worker 专门负责：

```text
Render
```

---

# 38. 地图视频

地图部分可以预生成：

```text
地图截图
```

或：

```text
地图 Animation Sequence
```

例如：

```text
东京地图
↓
路线逐渐出现
↓
Pin 一个个点亮
```

然后加入最终视频。

---

# 39. 视频输出格式

MVP：

```text
MP4
```

Codec：

```text
H.264
```

Audio：

```text
AAC
```

这是兼容性最好的组合之一。

---

# 40. MVP 画质

免费用户：

```text
720 × 1280
```

Pro：

```text
1080 × 1920
```

这样视频本身也可以成为：

> Pro 付费点。

---

# 41. Free 视频

FREE：

```text
720P

30 秒

基础模板

基础音乐

最多 10 张照片

TabiTrace 水印
```

---

# 42. Pro 视频

PRO：

```text
1080P

更多照片

全部模板

全部音乐

高级地图动画

旅行文字

完整成就

无水印
```

---

# 43. 视频功能与 ¥490 Pro

首版不建议：

```text
视频单独再收费
```

推荐直接加入：

```text
Trip Pro
```

例如：

# ¥490 / 次旅行

包含：

```text
无限打卡

更多照片

高清旅行卡

高清旅行视频

去水印
```

这样：

> ¥490 的付费价值会明显提高。

---

# 44. 视频传播价值

免费版保留：

```text
Made with TabiTrace
```

用户发到：

```text
小红书

抖音

Instagram

TikTok
```

就相当于：

> 免费广告。

因此免费用户的视频不一定完全限制。

---

# 45. 视频分享页

生成完成以后：

```text
你的东京旅行视频
```

页面：

```text
[ Video Preview ]

TOKYO 2026

30 秒

1080 × 1920

[ 下载视频 ]

[ 复制分享链接 ]
```

---

# 46. 分享链接

例如：

```text
tabitrace.com/v/abc123
```

网页中可以：

```text
在线播放视频
```

并显示：

```text
用 TabiTrace 记录你的旅行
```

CTA：

```text
[ 开始我的旅行 ]
```

形成新的传播入口。

---

# 47. 视频页面 SEO / Social Preview

分享页面应该生成：

```text
Open Graph

Title

Description

Thumbnail
```

例如：

```text
Yang's Tokyo Journey

6 Days · 12 Places · Tokyo 2026
```

---

# 48. 视频封面

用户可以选择：

```text
自动生成
```

或者：

```text
选择某张照片
```

系统自动加入：

```text
TOKYO

2026

MY JOURNEY
```

---

# 49. 视频生成进度

因为视频不能瞬间生成。

UI 显示：

```text
正在制作你的旅行视频

████████░░

72%
```

状态：

```text
正在整理照片

↓

正在生成地图

↓

正在制作动画

↓

正在合成音乐

↓

正在导出视频
```

---

# 50. MVP 不要做

第一版视频功能明确不做：

```text
自由时间轴

用户自由裁剪视频

视频滤镜

大量特效

几十种字体

自由字幕设计

视频素材上传

复杂音乐剪辑

AI 自动配音

人物识别

AI 自动剪辑

4K

多轨音频
```

---

# 51. 第二阶段功能

后续可以增加：

## AI 自动选图

系统自动从：

```text
100 张照片
```

选出：

```text
20 张代表照片
```

---

## AI 旅行总结

例如：

```text
6 天东京旅行

从浅草的寺庙，
到涩谷的夜色，
这一趟旅行留下了
12 个地点和 86 张照片。
```

自动作为：

```text
视频旁白 / 字幕
```

---

# 52. AI 视频标题

自动生成：

```text
六天五夜，我终于走完了东京
```

或者：

```text
我的东京旅行 · 2026
```

---

# 53. AI 音乐匹配

根据旅行：

```text
城市

海边

情侣

自然

夜景
```

推荐不同 BGM。

---

# 54. GPS 动画

以后如果有 GPS 轨迹：

可以制作：

```text
东京站
      ↓
 银座
      ↓
东京塔
      ↓
涩谷
```

真实移动轨迹动画。

---

# 55. 年度旅行视频

后期非常值得做：

# 我的 2026

自动汇总：

```text
8 Trips

6 Countries

18 Cities

86 Places

1260 Photos
```

生成：

```text
2026 Travel Wrapped
```

类似：

> Spotify Wrapped。

这会非常有传播潜力。

---

# 56. 城市纪念视频

例如：

```text
TOKYO COMPLETED

24 / 30

80%
```

自动生成：

> 东京探索纪念视频。

---

# 57. 全球足迹视频

后期：

```text
世界地图
```

逐渐出现：

```text
东京

大阪

首尔

巴黎

纽约
```

最后：

```text
7 Countries

18 Cities

126 Places
```

---

# 58. 产品未来关系

最终 TabiTrace 的旅行成果可以形成：

```text
Trip

├── 地图
│
├── 照片
│
├── 日记
│
├── 成就
│
├── 数据统计
│
├── 分享卡
│
└── 旅行视频
```

视频是所有数据的：

> 最终动态展示层。

---

# 59. 开发优先级

## Phase 1

先完成：

```text
旅行

地点

打卡

照片

统计
```

---

## Phase 2

完成：

```text
旅行分享卡
```

---

## Phase 3

再开发：

# 旅行视频

因为视频依赖：

```text
地图
照片
地点
日期
统计
成就
```

这些基础数据。

---

# 60. 视频 MVP 范围

第一版只做：

```text
30 秒

9:16

MP4

3 个模板

3～5 首音乐

照片

地图

地点

统计

成就

Logo
```

这已经足够上线验证。

---

# 61. 视频功能成功指标

重点观察：

```text
旅行完成 → 点击生成视频
```

转化率。

以及：

```text
视频生成成功率
```

---

```text
视频生成 → 下载
```

---

```text
视频生成 → 分享
```

---

```text
免费视频 → Pro
```

---

# 62. 推荐目标指标

例如：

```text
100 个完成旅行用户

↓

50 人生成视频

↓

40 人下载

↓

20 人分享

↓

8 人升级 Pro
```

具体目标上线后再根据真实数据调整。

---

# 63. 最终用户体验

用户完成旅行之后：

```text
🎉
你的东京旅行完成了

6 Days

12 Places

36 Photos

3 Achievements


生成属于你的旅行回忆

[ 旅行纪念卡 ]

[ 旅行视频 ]
```

点击：

```text
旅行视频
```

↓

```text
选择风格

Journal
Minimal
City
```

↓

```text
生成
```

↓

最终得到：

```text
TOKYO
2026

6 DAYS

12 PLACES

36 PHOTOS

40% EXPLORED
```

配合：

```text
地图
照片
路线
音乐
成就
旅行文字
```

形成一段：

> 真正值得保存、也值得发出去的旅行视频。

---

# 64. 功能最终定位

TabiTrace 不应该变成：

> 一个视频剪辑软件。

视频功能的产品原则应该始终是：

# 用户负责旅行  
# TabiTrace 负责把旅行变成故事

这才是旅行视频功能真正的核心价值。