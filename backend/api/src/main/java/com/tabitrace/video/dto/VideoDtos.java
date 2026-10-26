package com.tabitrace.video.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class VideoDtos {
    private VideoDtos() {}

    /** 分镜段落覆盖：数组顺序即段落顺序；可以关闭某段、改段落标题。开场和结尾固定在首尾。 */
    public record SegmentOverride(@NotBlank @Size(max = 80) String key, Boolean enabled, @Size(max = 40) String title) {}

    /**
     * 故事内容设置。所有开关为 null 时按「全部开启」处理；
     * visualStyle 为画面调色：NATURAL 自然纪实 / FRESH 日系清新 / FILM 电影胶片 / URBAN 城市质感，null 按 NATURAL。
     * 旧版本保存的 mapMode 等路线字段会被忽略（旅行路线动画已从 Travel Story 移除）。
     */
    public record StorySettings(
            @Size(max = 60) String title,
            @Size(max = 60) String endingText,
            Boolean showTitle,
            Boolean showDate,
            Boolean showPlaceNames,
            Boolean showCheckinText,
            Boolean showWeather,
            Boolean showStats,
            Boolean showAchievements,
            Boolean showEnding,
            @Valid @Size(max = 60) List<SegmentOverride> segments,
            @Size(max = 20) String visualStyle,
            /** 背景音乐音量 0–100（已统一响度后的比例），null 按 50 */
            Integer musicVolume) {
        public StorySettings(String title, String endingText, Boolean showTitle, Boolean showDate, Boolean showPlaceNames, Boolean showCheckinText,
                             Boolean showWeather, Boolean showStats, Boolean showAchievements, Boolean showEnding,
                             List<SegmentOverride> segments, String visualStyle) {
            this(title, endingText, showTitle, showDate, showPlaceNames, showCheckinText, showWeather, showStats, showAchievements, showEnding,
                    segments, visualStyle, null);
        }
    }

    /**
     * 创建 / 更新视频项目。showText / showAchievements 保留给旧前端；
     * 传了 settings 时以 settings 为准，并反向同步这两个旧字段。
     */
    public record UpsertVideoProjectRequest(
            @NotBlank String templateCode,
            String aspectRatio,
            Integer duration,
            String musicCode,
            String quality,
            Long coverPhotoId,
            Boolean showText,
            Boolean showAchievements,
            @Valid StorySettings settings,
            @NotNull List<Long> photoIds,
            /** 音乐来源：SYSTEM（musicCode）/ USER（userMusicId，「我的音乐」）/ NONE；为空时按提交的字段推断 */
            String musicSource,
            Long userMusicId) {
        public UpsertVideoProjectRequest(String templateCode, String aspectRatio, Integer duration, String musicCode, String quality,
                                         Long coverPhotoId, Boolean showText, Boolean showAchievements,
                                         StorySettings settings, List<Long> photoIds) {
            this(templateCode, aspectRatio, duration, musicCode, quality, coverPhotoId, showText, showAchievements, settings, photoIds, null, null);
        }
    }

    /** 一个分镜段落。PLACE 段的 meta.shots 是每张照片的停留秒数。 */
    public record SceneView(
            String key,
            String type,
            String title,
            String subtitle,
            double start,
            double duration,
            List<Long> photoIds,
            boolean enabled,
            boolean pinned,
            Map<String, Object> meta) {}

    /** notices：数据缺失被自动跳过的内容（没有天气、坐标不足等），直接展示给用户；grade：成片调色（同 visualStyle）。 */
    public record StoryboardView(int totalDuration, String templateCode, String resolution, boolean watermark,
                                 String transition, double transitionSeconds,
                                 List<SceneView> scenes, List<String> notices, String grade) {}

    public record VideoProjectView(
            Long id,
            Long tripId,
            String name,
            String templateCode,
            String aspectRatio,
            Integer duration,
            String quality,
            String resolution,
            boolean watermark,
            String musicCode,
            /** SYSTEM / USER / null（无音乐） */
            String musicSource,
            /** 「我的音乐」的 id（musicSource = USER） */
            Long userMusicId,
            Long coverPhotoId,
            boolean showText,
            boolean showAchievements,
            StorySettings settings,
            String status,
            Integer progress,
            String renderStage,
            String renderer,
            String outputUrl,
            String errorCode,
            String errorMessage,
            /** 生成成功但有降级（逗号分隔）：MUSIC_FALLBACK = 原选择的音乐不可用，本次已用无音乐生成 */
            String renderWarning,
            List<Long> photoIds,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime completedAt,
            /** 背景音乐的完整署名（CC BY 要求）；发布到 YouTube 等平台时需要贴进描述。无需署名时为 null */
            String musicCredit) {}

    public record VideoTemplateView(String code, String name, String englishName, String description, String suitableFor,
                                    String pace, String transition, double transitionSeconds, String plan,
                                    String recommendedMusic) {}

    /**
     * 选择器用的曲目信息：只有 45 秒试听地址，不包含原曲存储路径。
     * 授权信息（协议、来源、署名文本）是公开信息，用于卡片上的授权标签与详情。
     */
    public record VideoMusicView(String code, String name, String category, String mood, Double durationSeconds,
                                 String plan, List<String> recommendedTemplates, String artist, List<String> moods, List<String> instruments,
                                 Integer bpm, String energy, boolean essential, String previewUrl,
                                 boolean attributionRequired, String attributionText, String license, String licenseUrl,
                                 String source, String sourceUrl, boolean commercialUse, boolean derivativesAllowed) {}

    /** 开发环境版权后台：完整授权信息 */
    public record MusicLicenseView(String code, String name, String artist, String source, String sourceUrl, String license, String licenseUrl,
                                   String licenseNotes, boolean attributionRequired, String attributionText, boolean commercialUse, boolean exportAllowed,
                                   String status, String plan, boolean enabled, java.time.LocalDate licenseCheckedAt, java.time.LocalDate downloadedAt,
                                   String fileSha256, Double durationSeconds, Integer bpm, String bpmSource,
                                   Double loudnessLufs, Double introStart, Double mainStart, Double highlightStart, Double outroStart) {}
}
