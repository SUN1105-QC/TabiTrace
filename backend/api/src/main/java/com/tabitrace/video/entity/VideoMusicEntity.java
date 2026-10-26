package com.tabitrace.video.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 背景音乐曲库（V10 起包含完整版权信息，V14 精选为 5 个旅行氛围分类）。数据源：backend/scripts/music/catalog.json + analysis.json。
 * 只有 status = APPROVED、enabled 且音频已导入自己存储（objectKey）的曲目会出现在 Travel Story 音乐选择器。
 * 「无音乐」不是一条记录：视频项目的 music_code 为 NULL。
 */
public class VideoMusicEntity {
    public String code;
    public String name;
    /** WARM 温暖旅程 / CITY_NIGHT 城市夜色 / MORNING 清晨治愈 / LOFI Lo-fi / CINEMATIC 电影感 */
    public String category;
    /** 逗号分隔的统一情绪标签（warm, nostalgic, calm, …） */
    public String mood;
    public BigDecimal durationSeconds;
    /** FREE / PRO */
    public String plan;
    /** 推荐模板，逗号分隔（JOURNAL,MINIMAL,CITY） */
    public String recommendedTemplates;
    public Integer sortOrder;
    public Boolean enabled;

    public String artist;
    public String source;
    public String sourceUrl;
    public String downloadUrl;
    public String license;
    public String licenseUrl;
    public String licenseNotes;
    public Boolean attributionRequired;
    public String attributionText;
    public Boolean commercialUse;
    /** 授权允许剪辑 / 改编（成片会截取片段、淡入淡出、循环） */
    public Boolean derivativesAllowed;
    public Boolean exportAllowed;
    /** APPROVED / REVIEW_REQUIRED / REJECTED */
    public String status;
    public Integer bpm;
    /** official：作者公布；null：未标注 */
    public String bpmSource;
    /** LOW / MEDIUM / HIGH：规则推荐时与视频时长、照片节奏匹配 */
    public String energy;
    public String instruments;
    public Boolean essential;
    /** 原曲在对象存储中的路径：只给 Worker 用，不会返回给浏览器 */
    public String objectKey;
    /** 45 秒试听片段（已统一响度）的存储路径 */
    public String previewKey;
    public String fileSha256;
    public BigDecimal loudnessLufs;
    public BigDecimal introStart;
    public BigDecimal mainStart;
    public BigDecimal highlightStart;
    public BigDecimal outroStart;
    public LocalDate licenseCheckedAt;
    public LocalDate downloadedAt;

    /** 可以出现在选择器、可以用于生成：已启用、授权已核验、音频已导入存储 */
    public boolean usable() { return Boolean.TRUE.equals(enabled) && "APPROVED".equals(status) && objectKey != null && !objectKey.isBlank(); }
}
