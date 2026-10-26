package com.tabitrace.photo.mapper;

import com.tabitrace.photo.entity.PhotoEntity;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PhotoMapper {
    String COLS = "id,user_id,trip_id,checkin_id,storage_key,image_url,thumb_key,thumb_url,medium_key,medium_url,width,height,file_size,mime_type,is_featured AS featured,captured_at,created_at";
    @Insert("""
      INSERT INTO photos(user_id,trip_id,checkin_id,storage_key,image_url,thumb_key,thumb_url,medium_key,medium_url,width,height,file_size,mime_type,is_featured,captured_at,created_at)
      VALUES(#{userId},#{tripId},#{checkinId},#{storageKey},#{imageUrl},#{thumbKey},#{thumbUrl},#{mediumKey},#{mediumUrl},#{width},#{height},#{fileSize},#{mimeType},#{featured},#{capturedAt},UTC_TIMESTAMP())
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(PhotoEntity photo);
    @Select("SELECT "+COLS+" FROM photos WHERE id=#{id}") PhotoEntity findById(Long id);
    @Select("SELECT "+COLS+" FROM photos WHERE trip_id=#{tripId} ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listByTrip(Long tripId);
    @Select("SELECT "+COLS+" FROM photos WHERE checkin_id=#{checkinId} ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listByCheckin(Long checkinId);
    @Select("SELECT "+COLS+" FROM photos WHERE trip_id=#{tripId} AND is_featured=TRUE ORDER BY COALESCE(captured_at,created_at),id") List<PhotoEntity> listFeatured(Long tripId);
    @Select("SELECT COUNT(*) FROM photos WHERE trip_id=#{tripId}") int countByTrip(Long tripId);
    /** 没有关联打卡、单独上传的最近照片（按时间倒序，最多 limit 张） */
    @Select("SELECT "+COLS+" FROM photos WHERE trip_id=#{tripId} AND checkin_id IS NULL ORDER BY COALESCE(captured_at,created_at) DESC,id DESC LIMIT #{limit}") List<PhotoEntity> recentUnattached(@Param("tripId") Long tripId,@Param("limit") int limit);
    /**
     * 照片墙游标分页。排序时间与前端 utils/gallery.photoTime 一致：拍摄时间 → 关联打卡时间 → 落在旅行日期内的上传时间；
     * 都没有的照片排在最后（按 id）。winStart / winEnd 是旅行日期在用户时区下对应的 UTC 区间。
     */
    @Select("""
      <script>
      SELECT * FROM (
        SELECT p.id,p.user_id,p.trip_id,p.checkin_id,p.storage_key,p.image_url,p.thumb_key,p.thumb_url,p.medium_key,p.medium_url,p.width,p.height,p.file_size,p.mime_type,
               p.is_featured AS featured,p.captured_at,p.created_at,
               COALESCE(p.captured_at,c.checkin_time,CASE WHEN p.created_at &gt;= #{winStart} AND p.created_at &lt; #{winEnd} THEN p.created_at END) AS sort_at
        FROM photos p LEFT JOIN checkins c ON c.id=p.checkin_id
        WHERE p.trip_id=#{tripId}
        <if test="filter == 'FEATURED'"> AND p.is_featured=TRUE</if>
        <if test="filter == 'LINKED'"> AND p.checkin_id IS NOT NULL</if>
        <if test="filter == 'UNLINKED'"> AND p.checkin_id IS NULL</if>
      ) x
      <where>
        <if test="cursorId != null and cursorAt != null and desc"> (x.sort_at IS NULL OR x.sort_at &lt; #{cursorAt} OR (x.sort_at = #{cursorAt} AND x.id &lt; #{cursorId}))</if>
        <if test="cursorId != null and cursorAt != null and !desc"> (x.sort_at IS NULL OR x.sort_at &gt; #{cursorAt} OR (x.sort_at = #{cursorAt} AND x.id &gt; #{cursorId}))</if>
        <if test="cursorId != null and cursorAt == null and desc"> x.sort_at IS NULL AND x.id &lt; #{cursorId}</if>
        <if test="cursorId != null and cursorAt == null and !desc"> x.sort_at IS NULL AND x.id &gt; #{cursorId}</if>
      </where>
      ORDER BY (x.sort_at IS NULL)<if test="desc">, x.sort_at DESC, x.id DESC</if><if test="!desc">, x.sort_at ASC, x.id ASC</if>
      LIMIT #{limit}
      </script>
      """)
    List<PhotoEntity> page(@Param("tripId") Long tripId, @Param("filter") String filter, @Param("desc") boolean desc,
                           @Param("winStart") java.time.LocalDateTime winStart, @Param("winEnd") java.time.LocalDateTime winEnd,
                           @Param("cursorAt") java.time.LocalDateTime cursorAt, @Param("cursorId") Long cursorId, @Param("limit") int limit);
    @Select("SELECT COUNT(*) AS total,COALESCE(SUM(is_featured),0) AS featured,COALESCE(SUM(checkin_id IS NOT NULL),0) AS linked FROM photos WHERE trip_id=#{tripId}")
    java.util.Map<String,Object> counts(Long tripId);
    @Update("UPDATE photos SET is_featured=#{featured} WHERE id=#{id}") int setFeatured(@Param("id") Long id,@Param("featured") boolean featured);
    @Update("UPDATE photos SET checkin_id=#{checkinId},captured_at=#{capturedAt} WHERE id=#{id}") int update(PhotoEntity photo);
    @Delete("DELETE FROM photos WHERE id=#{id}") int delete(Long id);
    /** 删除照片后清掉 Travel Story 里指向它的封面（照片列表由外键级联删除） */
    @Update("UPDATE video_projects SET cover_photo_id=NULL WHERE cover_photo_id=#{id}") int clearVideoCover(Long id);
}
