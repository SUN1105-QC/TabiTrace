package com.tabitrace.memory.mapper;

import com.tabitrace.trip.entity.TripEntity;
import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;
import java.util.List;

/** 旅行回忆中心的聚合查询。「归档旅行」统一指 status 为 COMPLETED 或 ARCHIVED 的旅行。 */
@Mapper
public interface MemoryMapper {

    class PhotoRow { public Long id; public Long tripId; public String tripTitle; public String imageUrl; public Boolean featured; public LocalDateTime capturedAt; public LocalDateTime createdAt; }
    class NoteRow { public String note; public String placeNameSnapshot; }
    class StoryRow { public Long id; public Long tripId; public String tripTitle; public String name; public String templateCode; public Integer duration; public String outputUrl; public String renderer; public Long coverPhotoId; public LocalDateTime completedAt; public LocalDateTime updatedAt; }
    class ShareRow { public Long id; public Long tripId; public String tripTitle; public String shareToken; public Long viewCount; public LocalDateTime createdAt; }
    class AchievementRow { public String code; public String name; public String description; public Long tripId; public String tripTitle; public LocalDateTime earnedAt; }

    /** 最近结束的旅行在前 */
    @Select("SELECT * FROM trips WHERE user_id=#{userId} AND status IN ('COMPLETED','ARCHIVED') ORDER BY end_date DESC,id DESC")
    List<TripEntity> archivedTrips(Long userId);

    @Select("SELECT COUNT(*) FROM photos p JOIN trips t ON t.id=p.trip_id WHERE t.user_id=#{userId} AND t.status IN ('COMPLETED','ARCHIVED')")
    int countArchivedPhotos(Long userId);

    /** 某段旅行的照片：精选在前，再按拍摄时间 */
    @Select("""
      SELECT id,trip_id,image_url,is_featured AS featured,captured_at,created_at FROM photos WHERE trip_id=#{tripId}
      ORDER BY is_featured DESC,COALESCE(captured_at,created_at),id LIMIT #{limit}
      """)
    List<PhotoRow> topPhotos(@Param("tripId") Long tripId, @Param("limit") int limit);

    @Select("SELECT image_url FROM photos WHERE id=#{id}") String photoUrl(Long id);
    @Select("SELECT COUNT(*) FROM photos WHERE trip_id=#{tripId}") int countPhotos(Long tripId);

    /** 最后一条写了文字的打卡 */
    @Select("SELECT note,place_name_snapshot FROM checkins WHERE trip_id=#{tripId} AND note IS NOT NULL AND TRIM(note)<>'' ORDER BY checkin_time DESC,id DESC LIMIT 1")
    NoteRow lastNote(Long tripId);

    /** 已生成、可播放的 Travel Story（本地模拟渲染器不产生真实文件，排除） */
    @Select("""
      SELECT v.id,v.trip_id,t.title AS trip_title,v.name,v.template_code,v.duration,v.output_url,v.renderer,v.cover_photo_id,v.completed_at,v.updated_at
      FROM video_projects v JOIN trips t ON t.id=v.trip_id
      WHERE t.user_id=#{userId} AND t.status IN ('COMPLETED','ARCHIVED') AND v.status='COMPLETED' AND v.output_url IS NOT NULL
        AND COALESCE(v.renderer,'')<>'MOCK' AND v.output_url NOT LIKE '%example.invalid%'
      ORDER BY COALESCE(v.completed_at,v.updated_at) DESC,v.id DESC
      """)
    List<StoryRow> stories(Long userId);

    /** 仍然有效的分享页 */
    @Select("""
      SELECT s.id,s.trip_id,t.title AS trip_title,s.share_token,s.view_count,s.created_at
      FROM share_links s JOIN trips t ON t.id=s.trip_id
      WHERE t.user_id=#{userId} AND t.status IN ('COMPLETED','ARCHIVED') AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>UTC_TIMESTAMP())
      ORDER BY s.created_at DESC,s.id DESC
      """)
    List<ShareRow> shareLinks(Long userId);

    /** 值得回看的照片：优先指定年份的旅行，再精选优先、越新越前 */
    @Select("""
      SELECT p.id,p.trip_id,t.title AS trip_title,p.image_url,p.is_featured AS featured,p.captured_at,p.created_at
      FROM photos p JOIN trips t ON t.id=p.trip_id
      WHERE t.user_id=#{userId} AND t.status IN ('COMPLETED','ARCHIVED')
      ORDER BY (YEAR(t.start_date)=#{year}) DESC,p.is_featured DESC,COALESCE(p.captured_at,p.created_at) DESC,p.id DESC LIMIT #{limit}
      """)
    List<PhotoRow> highlightPhotos(@Param("userId") Long userId, @Param("year") int year, @Param("limit") int limit);

    @Select("SELECT COUNT(*) FROM photos p JOIN trips t ON t.id=p.trip_id WHERE t.user_id=#{userId} AND t.status IN ('COMPLETED','ARCHIVED') AND YEAR(t.start_date)=#{year}")
    int countPhotosInYear(@Param("userId") Long userId, @Param("year") int year);

    @Select("""
      SELECT a.code,a.name,a.description,ua.trip_id,t.title AS trip_title,ua.earned_at
      FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id LEFT JOIN trips t ON t.id=ua.trip_id
      WHERE ua.user_id=#{userId} ORDER BY ua.earned_at DESC,ua.id DESC LIMIT #{limit}
      """)
    List<AchievementRow> recentAchievements(@Param("userId") Long userId, @Param("limit") int limit);

    /** 不同成就的个数（同一成就在多段旅行里获得只算一次） */
    @Select("SELECT COUNT(DISTINCT achievement_id) FROM user_achievements WHERE user_id=#{userId}") int countAchievements(Long userId);
}
