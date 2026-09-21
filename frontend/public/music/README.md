# 视频背景音乐素材

这里的音轨同时被两处使用：

1. **前端试听**：`/trips/{id}/video` 页面的音乐选择器按 `musicCode` 直接请求 `/music/<CODE>.<ext>`。
2. **视频渲染**：`backend/video-worker` 的 `FfmpegRenderer.resolveMusic()` 从 `VIDEO_MUSIC_DIR`（默认就是这个目录）按同样的文件名查找，混入 MP4。

## 文件命名

文件名必须等于后端允许的 `music_code`，扩展名按 `.mp3 → .wav → .m4a → .aac` 的顺序查找：

| music_code | 显示名 |
| --- | --- |
| `WARM_JOURNEY` | Warm Journey |
| `TOKYO_NIGHT` | Tokyo Night |
| `SLOW_MORNING` | Slow Morning |
| `CITY_WALK` | City Walk |
| `MEMORIES` | Memories |

`NONE` 表示不加音乐，不需要文件。

新增音乐时，同时要在 `VideoService.validate()` 的白名单和前端 `MUSIC_TRACKS` 里登记，否则接口会返回 `VIDEO_MUSIC_INVALID`。

## 当前文件是占位音轨

仓库里的 `.wav` 是用 `Web Audio` 同款正弦合成脚本临时生成的循环片段（无版权问题，但也谈不上好听），只为让试听与渲染链路能完整跑通。

**上线前请替换成正式授权的音乐**：把同名的 `.mp3` 放进本目录即可，后端查找顺序会优先命中 `.mp3`，前端播放器也会自动切换过去，代码不用改。替换后建议删掉对应的 `.wav`。
