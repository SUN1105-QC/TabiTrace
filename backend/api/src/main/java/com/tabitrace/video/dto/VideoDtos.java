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
     * 故事内容设置。所有开关为 null 时按「全部开启」处理；mapMode 为 OFF / SIMPLE / FULL；
     * visualStyle 为画面调色：NATURAL 自然纪实 / FRESH 日系清新 / FILM 电影胶片 / URBAN 城市质感，null 按 NATURAL。
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
            String mapMode,
            @Valid @Size(max = 60) List<SegmentOverride> segments,
            @Size(max = 20) String visualStyle) {}

    /**
     * 创建 / 更新视频项目。showText / showMap / showAchievements 保留给旧前端；
     * 传了 settings 时以 settings 为准，并反向同步这三个旧字段。
     */
    public record UpsertVideoProjectRequest(
            @NotBlank String templateCode,
            String aspectRatio,
            Integer duration,
            String musicCode,
            String quality,
            Long coverPhotoId,
            Boolean showText,
            Boolean showMap,
            Boolean showAchievements,
            @Valid StorySettings settings,
            @NotNull List<Long> photoIds) {}

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
            Long coverPhotoId,
            boolean showText,
            boolean showMap,
            boolean showAchievements,
            StorySettings settings,
            String status,
            Integer progress,
            String renderStage,
            String renderer,
            String outputUrl,
            String errorCode,
            String errorMessage,
            List<Long> photoIds,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime completedAt) {}

    public record VideoTemplateView(String code, String name, String englishName, String description, String suitableFor,
                                    String pace, String transition, double transitionSeconds, String plan,
                                    String recommendedMusic) {}

    public record VideoMusicView(String code, String name, String category, String mood, Double durationSeconds,
                                 String plan, String recommendedTemplate) {}
}
