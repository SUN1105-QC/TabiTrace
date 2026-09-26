package com.tabitrace.worker;

/**
 * 一条待渲染的视频任务。storyboardJson 是 API 在「开始生成」时冻结的分镜，Worker 只按它渲染，
 * 不再自己查打卡 / 成就去编排内容，保证预览和成片一致。
 */
public record VideoJob(Long id, Long userId, Long tripId, String templateCode, String aspectRatio, Integer duration,
                       String musicCode, String quality, String planType, String storyboardJson) {}
