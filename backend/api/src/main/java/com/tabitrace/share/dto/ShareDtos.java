package com.tabitrace.share.dto;

import com.tabitrace.achievement.dto.AchievementDtos.AchievementView;
import com.tabitrace.checkin.dto.CheckinDtos.TimelineDay;
import com.tabitrace.photo.dto.PhotoDtos.PhotoView;
import com.tabitrace.summary.dto.SummaryDtos.TripSummary;
import com.tabitrace.trip.dto.TripDtos.TripView;
import java.time.LocalDateTime;
import java.util.List;

public final class ShareDtos {
    private ShareDtos() {}
    public record CreateShareRequest(LocalDateTime expiresAt) {}
    public record ShareLinkView(Long id,String token,String status,long viewCount,LocalDateTime createdAt,LocalDateTime expiresAt,LocalDateTime revokedAt,String url) {}
    public record PublicShareView(TripView trip,TripSummary summary,List<TimelineDay> timeline,List<PhotoView> featuredPhotos,List<AchievementView> achievements,String ownerNickname) {}
}
