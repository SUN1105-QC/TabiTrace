package com.tabitrace.video.mapper;

import com.tabitrace.video.entity.VideoMusicEntity;
import com.tabitrace.video.entity.VideoTemplateEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

/** 视频模板 / 音乐目录，以及生成分镜需要的少量旅行数据查询。 */
@Mapper
public interface VideoCatalogMapper {
    @Select("SELECT * FROM video_templates ORDER BY sort_order,code") List<VideoTemplateEntity> templates();
    @Select("SELECT * FROM video_templates WHERE code=#{code}") VideoTemplateEntity template(String code);
    @Select("SELECT * FROM video_music ORDER BY sort_order,code") List<VideoMusicEntity> music();
    @Select("SELECT * FROM video_music WHERE code=#{code}") VideoMusicEntity musicByCode(String code);

    @Select("""
      SELECT a.name FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id
      WHERE ua.user_id=#{userId} AND ua.trip_id=#{tripId} ORDER BY ua.earned_at,a.id
      """)
    List<String> earnedAchievementNames(@Param("userId") Long userId, @Param("tripId") Long tripId);
}
