package com.tabitrace.video.service;

import com.tabitrace.video.entity.VideoProjectEntity;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;

@Component
public class VideoMockRenderer {
    private final VideoProjectMapper mapper;private final boolean enabled;
    public VideoMockRenderer(VideoProjectMapper mapper,@Value("${app.video.mock-renderer-enabled:true}") boolean enabled){this.mapper=mapper;this.enabled=enabled;}
    @Scheduled(fixedDelayString="${app.video.mock-renderer-interval-ms:2500}")
    public void tick(){if(!enabled)return;for(VideoProjectEntity p:mapper.listPending()){if("QUEUED".equals(p.status)){p.status="PROCESSING";p.progress=15;}else{p.progress=Math.min(100,(p.progress==null?0:p.progress)+25);if(p.progress>=100){p.status="COMPLETED";p.outputKey="mock/videos/"+p.id+".mp4";p.outputUrl="https://example.invalid/videos/"+p.id+".mp4";p.completedAt=LocalDateTime.now(java.time.ZoneOffset.UTC);}}mapper.updateStatus(p);}}
}
