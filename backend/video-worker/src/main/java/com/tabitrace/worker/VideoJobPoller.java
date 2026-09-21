package com.tabitrace.worker;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Component
public class VideoJobPoller {
    private final JdbcTemplate jdbc;private final FfmpegRenderer renderer;private final WorkerStorage storage;
    public VideoJobPoller(JdbcTemplate jdbc,FfmpegRenderer renderer,WorkerStorage storage){this.jdbc=jdbc;this.renderer=renderer;this.storage=storage;}
    @Scheduled(fixedDelayString="${worker.poll-ms:5000}") public void poll(){List<VideoJob> jobs=jdbc.query("SELECT v.*,t.plan_type FROM video_projects v JOIN trips t ON t.id=v.trip_id WHERE v.status='QUEUED' ORDER BY v.id LIMIT 1",(rs,n)->new VideoJob(rs.getLong("id"),rs.getLong("user_id"),rs.getLong("trip_id"),rs.getString("template_code"),rs.getString("aspect_ratio"),rs.getInt("duration"),rs.getString("music_code"),rs.getBoolean("show_text"),rs.getBoolean("show_map"),rs.getBoolean("show_achievements"),rs.getString("plan_type")));for(VideoJob j:jobs)process(j);}
    @Transactional public void process(VideoJob job){int claimed=jdbc.update("UPDATE video_projects SET status='PROCESSING',progress=10,updated_at=UTC_TIMESTAMP() WHERE id=? AND status='QUEUED'",job.id());if(claimed==0)return;try{jdbc.update("UPDATE video_projects SET progress=35 WHERE id=?",job.id());var file=renderer.render(job);jdbc.update("UPDATE video_projects SET progress=85 WHERE id=?",job.id());var saved=storage.save(job,file);jdbc.update("UPDATE video_projects SET status='COMPLETED',progress=100,output_key=?,output_url=?,completed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=?",saved.key(),saved.url(),job.id());}catch(Exception ex){String msg=ex.getMessage();if(msg!=null&&msg.length()>1500)msg=msg.substring(0,1500);jdbc.update("UPDATE video_projects SET status='FAILED',error_message=?,updated_at=UTC_TIMESTAMP() WHERE id=?",msg,job.id());}}
}
