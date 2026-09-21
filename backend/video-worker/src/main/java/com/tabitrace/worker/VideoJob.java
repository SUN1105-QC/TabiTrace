package com.tabitrace.worker;

public record VideoJob(Long id,Long userId,Long tripId,String templateCode,String aspectRatio,Integer duration,String musicCode,boolean showText,boolean showMap,boolean showAchievements,String planType) {}
