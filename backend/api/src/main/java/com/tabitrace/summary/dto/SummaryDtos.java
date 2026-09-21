package com.tabitrace.summary.dto;

import java.time.LocalDate;
import java.util.List;

public final class SummaryDtos {
    private SummaryDtos() {}
    public record DailyStatus(LocalDate date,int checkins,int photos,boolean hasRecord) {}
    public record OutputReadiness(int featuredPhotos,int achievementCount,int recordedDays,boolean shareReady,boolean videoReady) {}
    public record TripSummary(Long tripId,String title,String status,String planType,int days,int places,int photos,int cities,int areas,int officialPlacesCompleted,int officialPlacesTotal,int explorationRate,int achievements,List<DailyStatus> dailyRecords,OutputReadiness readiness) {}
}
