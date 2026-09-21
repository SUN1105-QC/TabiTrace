package com.tabitrace.video.mapper;

import com.tabitrace.video.entity.VideoProjectEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface VideoProjectMapper {
    @Insert("""
      INSERT INTO video_projects(user_id,trip_id,template_code,aspect_ratio,duration,music_code,show_text,show_map,show_achievements,status,progress,created_at,updated_at)
      VALUES(#{userId},#{tripId},#{templateCode},#{aspectRatio},#{duration},#{musicCode},#{showText},#{showMap},#{showAchievements},#{status},#{progress},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(VideoProjectEntity p);
    @Select("SELECT * FROM video_projects WHERE id=#{id}") VideoProjectEntity findById(Long id);
    @Select("SELECT * FROM video_projects WHERE trip_id=#{tripId} ORDER BY id DESC") List<VideoProjectEntity> listByTrip(Long tripId);
    @Update("""
      UPDATE video_projects SET template_code=#{templateCode},aspect_ratio=#{aspectRatio},duration=#{duration},music_code=#{musicCode},show_text=#{showText},show_map=#{showMap},show_achievements=#{showAchievements},updated_at=UTC_TIMESTAMP() WHERE id=#{id} AND status='DRAFT'
      """) int updateDraft(VideoProjectEntity p);
    @Update("UPDATE video_projects SET status=#{status},progress=#{progress},output_key=#{outputKey},output_url=#{outputUrl},error_message=#{errorMessage},completed_at=#{completedAt},updated_at=UTC_TIMESTAMP() WHERE id=#{id}") int updateStatus(VideoProjectEntity p);
    @Delete("DELETE FROM video_projects WHERE id=#{id}") int delete(Long id);
    @Select("SELECT * FROM video_projects WHERE status IN ('QUEUED','PROCESSING') ORDER BY id LIMIT 20") List<VideoProjectEntity> listPending();
}
