package com.tabitrace.video.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

public final class VideoDtos {
    private VideoDtos() {}
    public record UpsertVideoProjectRequest(@NotBlank String templateCode,String aspectRatio,Integer duration,String musicCode,Boolean showText,Boolean showMap,Boolean showAchievements,@NotNull List<Long> photoIds) {}
    public record VideoProjectView(Long id,Long tripId,String templateCode,String aspectRatio,Integer duration,String musicCode,boolean showText,boolean showMap,boolean showAchievements,String status,Integer progress,String outputUrl,String errorMessage,List<Long> photoIds,LocalDateTime createdAt,LocalDateTime completedAt) {}
}
