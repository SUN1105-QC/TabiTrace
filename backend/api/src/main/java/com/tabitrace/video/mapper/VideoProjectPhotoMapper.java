package com.tabitrace.video.mapper;

import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface VideoProjectPhotoMapper {
    @Insert("INSERT INTO video_project_photos(video_project_id,photo_id,sort_order,duration,created_at) VALUES(#{projectId},#{photoId},#{sortOrder},#{duration},UTC_TIMESTAMP())")
    int add(@Param("projectId") Long projectId,@Param("photoId") Long photoId,@Param("sortOrder") int sortOrder,@Param("duration") Double duration);
    @Delete("DELETE FROM video_project_photos WHERE video_project_id=#{projectId}") int deleteByProject(Long projectId);
    @Select("SELECT photo_id FROM video_project_photos WHERE video_project_id=#{projectId} ORDER BY sort_order,id") List<Long> photoIds(Long projectId);
}
