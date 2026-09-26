package com.tabitrace.photo.mapper;

import com.tabitrace.photo.entity.PhotoEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PhotoMapper {
    @Insert("""
      INSERT INTO photos(user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured,captured_at,created_at)
      VALUES(#{userId},#{tripId},#{checkinId},#{storageKey},#{imageUrl},#{width},#{height},#{fileSize},#{mimeType},#{featured},#{capturedAt},UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(PhotoEntity photo);
    @Select("SELECT id,user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at FROM photos WHERE id=#{id}") PhotoEntity findById(Long id);
    @Select("SELECT id,user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at FROM photos WHERE trip_id=#{tripId} ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listByTrip(Long tripId);
    @Select("SELECT id,user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at FROM photos WHERE checkin_id=#{checkinId} ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listByCheckin(Long checkinId);
    @Select("SELECT id,user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at FROM photos WHERE trip_id=#{tripId} AND is_featured=TRUE ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listFeatured(Long tripId);
    @Select("SELECT COUNT(*) FROM photos WHERE trip_id=#{tripId}") int countByTrip(Long tripId);
    /** 没有关联打卡、单独上传的最近照片（按时间倒序，最多 limit 张） */
    @Select("SELECT id,user_id,trip_id,checkin_id,storage_key,image_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at FROM photos WHERE trip_id=#{tripId} AND checkin_id IS NULL ORDER BY COALESCE(captured_at,created_at) DESC,id DESC LIMIT #{limit}") List<PhotoEntity> recentUnattached(@Param("tripId") Long tripId,@Param("limit") int limit);
    @Update("UPDATE photos SET is_featured=#{featured} WHERE id=#{id}") int setFeatured(@Param("id") Long id,@Param("featured") boolean featured);
    @Update("UPDATE photos SET checkin_id=#{checkinId},captured_at=#{capturedAt} WHERE id=#{id}") int update(PhotoEntity photo);
    @Delete("DELETE FROM photos WHERE id=#{id}") int delete(Long id);
    /** 删除照片后清掉 Travel Story 里指向它的封面（照片列表由外键级联删除） */
    @Update("UPDATE video_projects SET cover_photo_id=NULL WHERE cover_photo_id=#{id}") int clearVideoCover(Long id);
}
