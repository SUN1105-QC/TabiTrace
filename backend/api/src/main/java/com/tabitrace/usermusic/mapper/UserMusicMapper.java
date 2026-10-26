package com.tabitrace.usermusic.mapper;

import com.tabitrace.usermusic.entity.UserMusicEntity;
import org.apache.ibatis.annotations.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface UserMusicMapper {
    @Insert("""
      INSERT INTO user_music(user_id,title,original_filename,storage_key,mime_type,file_size,status,copyright_confirmed,copyright_confirmed_at,created_at,updated_at)
      VALUES(#{userId},#{title},#{originalFilename},#{storageKey},#{mimeType},#{fileSize},#{status},#{copyrightConfirmed},#{copyrightConfirmedAt},UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
      """) @Options(useGeneratedKeys=true,keyProperty="id") int insert(UserMusicEntity m);
    @Select("SELECT * FROM user_music WHERE id=#{id}") UserMusicEntity findById(Long id);
    /** 「我的音乐」列表：不含已删除的 */
    @Select("SELECT * FROM user_music WHERE user_id=#{userId} AND status<>'DELETED' ORDER BY id DESC") List<UserMusicEntity> listVisible(Long userId);
    /** 占用额度的音乐：上传中 / 处理中 / 可用（失败与已删除的不占额度） */
    @Select("SELECT COUNT(*) AS tracks, COALESCE(SUM(file_size),0) AS bytes FROM user_music WHERE user_id=#{userId} AND status IN ('UPLOADING','PROCESSING','READY')")
    Map<String,Object> usage(Long userId);
    /** 领取处理：只有 UPLOADING 能进入 PROCESSING，防止重复提交并发处理 */
    @Update("UPDATE user_music SET status='PROCESSING',updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='UPLOADING'") int claim(Long id);
    @Update("UPDATE user_music SET status='READY',mime_type=#{mime},file_size=#{size},duration_seconds=#{duration},failure_code=NULL,updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='PROCESSING'")
    int ready(@Param("id") Long id,@Param("mime") String mime,@Param("size") long size,@Param("duration") BigDecimal duration);
    @Update("UPDATE user_music SET status='FAILED',failure_code=#{code},updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status IN ('UPLOADING','PROCESSING')")
    int fail(@Param("id") Long id,@Param("code") String code);
    @Update("UPDATE user_music SET title=#{title},updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND user_id=#{userId} AND status<>'DELETED'")
    int rename(@Param("id") Long id,@Param("userId") Long userId,@Param("title") String title);
    @Update("UPDATE user_music SET status='DELETED',deleted_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND user_id=#{userId} AND status<>'DELETED'")
    int softDelete(@Param("id") Long id,@Param("userId") Long userId);
    @Update("UPDATE user_music SET purged_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND purged_at IS NULL") int markPurged(Long id);

    /** 正在排队 / 生成中的视频是否用到这首音乐：用到时先不删存储文件，等生成结束再清理 */
    @Select("SELECT COUNT(*) FROM video_projects WHERE user_music_id=#{id} AND music_source='USER' AND status IN ('QUEUED','PROCESSING')")
    int countActiveRenders(Long id);
    /** 待清理文件：已删除或处理失败、文件还在、且没有排队 / 生成中的视频在用 */
    @Select("""
      SELECT m.* FROM user_music m WHERE m.status IN ('DELETED','FAILED') AND m.purged_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM video_projects v WHERE v.user_music_id=m.id AND v.music_source='USER' AND v.status IN ('QUEUED','PROCESSING'))
      ORDER BY m.id LIMIT #{limit}
      """) List<UserMusicEntity> listPurgeable(int limit);
    /** 拿到上传地址后一直没有完成的上传：视为放弃，标记删除（随后由清理任务删文件） */
    @Update("UPDATE user_music SET status='DELETED',deleted_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE status='UPLOADING' AND created_at < UTC_TIMESTAMP(6) - INTERVAL #{minutes} MINUTE")
    int abandonStale(int minutes);
}
