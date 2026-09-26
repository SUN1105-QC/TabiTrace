package com.tabitrace.video.service;

import com.tabitrace.video.entity.VideoProjectEntity;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 本地联调用的模拟渲染器：只推进状态，不生成任何文件。
 * 产物地址是 example.invalid 占位地址，并把 renderer 标为 MOCK——前端据此明确显示「Local Mock Renderer」，
 * 不会把它当成真实 MP4。跑真实 video-worker 时必须关闭（VIDEO_MOCK_RENDERER=false）。
 */
@Component
public class VideoMockRenderer {
    /** 与真实 Worker 相同的阶段顺序和进度，前端的阶段展示逻辑因此只有一套 */
    private static final List<String> STAGES = List.of("PREPARING", "MAP", "STORY", "MUSIC", "EXPORTING");
    private static final List<Integer> PROGRESS = List.of(10, 30, 55, 75, 90);

    private final VideoProjectMapper mapper;
    private final boolean enabled;

    public VideoMockRenderer(VideoProjectMapper mapper, @Value("${app.video.mock-renderer-enabled:true}") boolean enabled) {
        this.mapper = mapper;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.video.mock-renderer-interval-ms:2500}")
    public void tick() {
        if (!enabled) return;
        for (VideoProjectEntity p : mapper.listPending()) {
            if ("QUEUED".equals(p.status)) {
                p.status = "PROCESSING";
                p.renderer = "MOCK";
                p.renderStage = STAGES.get(0);
                p.progress = PROGRESS.get(0);
            } else {
                int next = STAGES.indexOf(p.renderStage) + 1;
                if (next <= 0 || next >= STAGES.size()) {
                    p.status = "COMPLETED";
                    p.progress = 100;
                    p.renderStage = null;
                    p.outputKey = "mock/videos/" + p.id + ".mp4";
                    p.outputUrl = "https://example.invalid/videos/" + p.id + ".mp4";
                    p.completedAt = LocalDateTime.now(java.time.ZoneOffset.UTC);
                } else {
                    p.renderStage = STAGES.get(next);
                    p.progress = PROGRESS.get(next);
                }
            }
            mapper.updateStatus(p);
        }
    }
}
