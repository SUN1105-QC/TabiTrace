package com.tabitrace.cost;

import org.apache.ibatis.annotations.*;
import java.time.LocalDate;
import java.util.List;

@Mapper
public interface CostMapper {
    class Daily { public long renderCount,outputSeconds; }
    class Storage {
        public long photoBytes,musicBytes,videoBytes,variantEstimateBytes,unknownPhotos,unknownVideos;
    }
    @Select("SELECT name FROM cost_control_locks WHERE name='video-render' FOR UPDATE") String lockGlobal();
    @Select("SELECT id FROM users WHERE id=#{userId} FOR UPDATE") Long lockUser(Long userId);
    @Select("SELECT COUNT(*) FROM video_projects WHERE status IN ('QUEUED','PROCESSING')") long activeGlobal();
    @Select("SELECT COUNT(*) FROM video_projects WHERE user_id=#{userId} AND status IN ('QUEUED','PROCESSING')") long activeUser(Long userId);
    @Insert("""
        INSERT INTO render_usage_daily(scope,usage_date,user_id,updated_at) VALUES(#{scope},#{day},#{userId},UTC_TIMESTAMP(6))
        ON DUPLICATE KEY UPDATE scope=VALUES(scope)
        """) int ensureDaily(@Param("scope") String scope,@Param("day") LocalDate day,@Param("userId") Long userId);
    @Select("SELECT render_count,output_seconds FROM render_usage_daily WHERE scope=#{scope} AND usage_date=#{day}")
    Daily daily(@Param("scope") String scope,@Param("day") LocalDate day);
    @Select("SELECT render_count,output_seconds FROM render_usage_daily WHERE scope=#{scope} AND usage_date=#{day} FOR UPDATE")
    Daily lockDaily(@Param("scope") String scope,@Param("day") LocalDate day);
    @Update("UPDATE render_usage_daily SET render_count=render_count+1,output_seconds=output_seconds+#{seconds},updated_at=UTC_TIMESTAMP(6) WHERE scope=#{scope} AND usage_date=#{day}")
    int increment(@Param("scope") String scope,@Param("day") LocalDate day,@Param("seconds") int seconds);
    @Select("""
        SELECT
          (SELECT COALESCE(SUM(GREATEST(COALESCE(file_size,0),0)),0) FROM photos WHERE user_id=#{userId}) AS photo_bytes,
          (SELECT COUNT(*) FROM photos WHERE user_id=#{userId} AND (file_size IS NULL OR file_size<=0)) AS unknown_photos,
          (SELECT COALESCE(SUM((thumb_key IS NOT NULL)*1048576+(medium_key IS NOT NULL)*5242880),0) FROM photos WHERE user_id=#{userId}) AS variant_estimate_bytes,
          (SELECT COALESCE(SUM(file_size),0) FROM user_music WHERE user_id=#{userId} AND purged_at IS NULL) AS music_bytes,
          (SELECT COALESCE(SUM(output_bytes),0) FROM video_projects WHERE user_id=#{userId}) AS video_bytes,
          (SELECT COUNT(*) FROM video_projects WHERE user_id=#{userId} AND renderer='FFMPEG' AND output_key IS NOT NULL AND output_bytes IS NULL) AS unknown_videos
        """) Storage storage(Long userId);
    @Insert("INSERT IGNORE INTO cost_alerts(scope,alert_date,kind,observed_value,threshold_value,created_at) VALUES(#{scope},#{day},#{kind},#{value},#{threshold},UTC_TIMESTAMP(6))")
    int alert(@Param("scope") String scope,@Param("day") LocalDate day,@Param("kind") String kind,@Param("value") long value,@Param("threshold") long threshold);
    @Select("SELECT id FROM users WHERE id>#{after} ORDER BY id LIMIT #{limit}") List<Long> scanUsers(@Param("after") long after,@Param("limit") int limit);
}
