package com.tabitrace.memory.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 旅行回忆中心：只统计当前用户已完成 / 已归档（COMPLETED、ARCHIVED）的旅行。 */
public final class MemoryDtos {
    private MemoryDtos() {}

    /** 概览：已归档旅行数、走过的城市数、这些旅行里的照片数、已生成的回忆作品数（可播放的 Travel Story + 有效分享页） */
    public record Overview(int archivedTrips, int cities, int photos, int creations) {}

    public record Moment(Long id, String imageUrl) {}

    /** 旅行里自己写下的一句打卡文字（真实内容，没有就为 null） */
    public record Note(String text, String place) {}

    /**
     * 一段归档旅行。cover 按 trip.coverImage → 第一张精选照片 → 第一张照片 解析，都没有时为 null（前端显示文字封面）。
     * moments 为最多 3 张照片（精选优先），moreMoments 为剩余照片数。
     */
    public record MemoryTrip(Long id, String title, String destinationName, String city, String countryCode, String status,
                             LocalDate startDate, LocalDate endDate, int days, int places, int photos, int achievements,
                             String cover, List<Moment> moments, int moreMoments, Note note,
                             int stories, Long latestStoryId, int shareLinks) {}

    public record TimelineEntry(Long id, String title, String city, LocalDate startDate, LocalDate endDate, String cover) {}

    /** 回忆作品：STORY（已生成的 Travel Story 视频）或 SHARE_LINK（有效的分享页） */
    public record Creation(String type, Long id, Long tripId, String tripTitle, String title, String preview,
                           String url, LocalDateTime createdAt, Integer duration, Long views) {}

    public record MemoryPhoto(Long id, Long tripId, String tripTitle, String imageUrl, boolean featured, LocalDateTime takenAt) {}

    public record MemoryAchievement(String code, String name, String description, Long tripId, String tripTitle, LocalDateTime earnedAt) {}

    /** 往年今日：DAY 同一天（±3 天）/ MONTH 同一个月 / SEASON 同一个季节；yearsAgo 为几年前 */
    public record Flashback(String kind, int yearsAgo, Long tripId, String title, String city, LocalDate startDate, LocalDate endDate,
                            String cover, int photos, List<Moment> moments) {}

    public record MemoriesView(Overview overview, List<MemoryTrip> trips, boolean hasMore, List<TimelineEntry> timeline,
                               List<Creation> creations, List<MemoryPhoto> photos, int photoYear,
                               List<MemoryAchievement> achievements, int achievementCount, Flashback flashback) {}

    public record TripPage(List<MemoryTrip> trips, boolean hasMore) {}
}
