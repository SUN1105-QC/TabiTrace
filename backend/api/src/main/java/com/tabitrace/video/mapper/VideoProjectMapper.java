package com.tabitrace.video.mapper;

import com.tabitrace.video.entity.VideoProjectEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface VideoProjectMapper {
    @Insert("""
      INSERT INTO video_projects(user_id,trip_id,name,template_code,aspect_ratio,duration,quality,cover_photo_id,music_code,
        show_text,show_map,show_achievements,settings_json,status,progress,created_at,updated_at)
      VALUES(#{userId},#{tripId},#{name},#{templateCode},#{aspectRatio},#{duration},#{quality},#{coverPhotoId},#{musicCode},
        #{showText},#{showMap},#{showAchievements},#{settingsJson},#{status},#{progress},UTC_TIMESTAMP(),UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(VideoProjectEntity p);
    @Select("SELECT * FROM video_projects WHERE id=#{id}") VideoProjectEntity findById(Long id);
    @Select("SELECT * FROM video_projects WHERE trip_id=#{tripId} ORDER BY id DESC") List<VideoProjectEntity> listByTrip(Long tripId);
    @Update("""
      UPDATE video_projects SET name=#{name},template_code=#{templateCode},aspect_ratio=#{aspectRatio},duration=#{duration},quality=#{quality},
        cover_photo_id=#{coverPhotoId},music_code=#{musicCode},show_text=#{showText},show_map=#{showMap},show_achievements=#{showAchievements},
        settings_json=#{settingsJson},updated_at=UTC_TIMESTAMP()
      WHERE id=#{id} AND status='DRAFT'
      """) int updateDraft(VideoProjectEntity p);
    @Update("""
      UPDATE video_projects SET status=#{status},progress=#{progress},render_stage=#{renderStage},renderer=#{renderer},
        output_key=#{outputKey},output_url=#{outputUrl},error_code=#{errorCode},error_message=#{errorMessage},
        completed_at=#{completedAt},updated_at=UTC_TIMESTAMP()
      WHERE id=#{id}
      """) int updateStatus(VideoProjectEntity p);
    /** 开始生成：冻结分镜并进入队列。只允许从 DRAFT / FAILED / COMPLETED 进入，防止重复排队。 */
    @Update("""
      UPDATE video_projects SET storyboard_json=#{storyboardJson},name=#{name},status='QUEUED',progress=0,render_stage=NULL,renderer=NULL,
        output_key=NULL,output_url=NULL,error_code=NULL,error_message=NULL,completed_at=NULL,updated_at=UTC_TIMESTAMP()
      WHERE id=#{id} AND status IN ('DRAFT','FAILED','COMPLETED')
      """) int queue(VideoProjectEntity p);
    @Delete("DELETE FROM video_projects WHERE id=#{id}") int delete(Long id);
    @Select("SELECT * FROM video_projects WHERE status IN ('QUEUED','PROCESSING') ORDER BY id LIMIT 20") List<VideoProjectEntity> listPending();
    /** 心跳超时的 PROCESSING 任务标为「生成中断」：Worker 崩溃或被重启后，这些任务不会再有人处理。 */
    @Update("""
      UPDATE video_projects SET status='FAILED',render_stage=NULL,error_code='RENDER_INTERRUPTED',error_message=#{message},updated_at=UTC_TIMESTAMP()
      WHERE status='PROCESSING' AND updated_at < UTC_TIMESTAMP() - INTERVAL #{seconds} SECOND
      """) int failStale(@Param("seconds") int seconds,@Param("message") String message);
}
