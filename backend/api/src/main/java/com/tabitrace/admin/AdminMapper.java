package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface AdminMapper {
    String USER_COLUMNS = "SELECT u.*,(SELECT COUNT(*) FROM trips t WHERE t.user_id=u.id AND t.expires_at>UTC_TIMESTAMP(6)) AS trips,(SELECT COUNT(*) FROM photos p WHERE p.user_id=u.id) AS photos FROM users u";
    String SEARCH = " WHERE u.role='USER' AND (#{status}='' OR u.status=#{status}) AND (#{q}='' OR LOCATE(#{q},u.email)>0 OR LOCATE(#{q},u.nickname)>0) ";
    @Select(USER_COLUMNS+SEARCH+" ORDER BY u.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<UserRow> users(@Param("q") String q,@Param("status") String status,@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM users u"+SEARCH) long userCount(@Param("q") String q,@Param("status") String status);
    @Select(USER_COLUMNS+" WHERE u.id=#{id} AND u.role='USER'") UserRow user(Long id);
    @Select("""
        SELECT (SELECT COUNT(*) FROM users WHERE role='USER') AS users,
        (SELECT COUNT(*) FROM users WHERE role='USER' AND status='DISABLED') AS disabled_users,
        (SELECT COUNT(*) FROM trips WHERE expires_at>UTC_TIMESTAMP(6)) AS trips,
        (SELECT COUNT(*) FROM photos) AS photos,(SELECT COUNT(*) FROM video_projects) AS videos,
        (SELECT COUNT(*) FROM video_projects WHERE status IN ('QUEUED','PROCESSING')) AS active_renders,
        (SELECT COUNT(*) FROM trips WHERE expires_at>UTC_TIMESTAMP(6) AND expires_at<=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY)) AS expiring_trips,
        (SELECT COUNT(*) FROM trips WHERE expires_at<=UTC_TIMESTAMP(6)) AS pending_deletion_trips,
        (SELECT COUNT(*) FROM support_messages WHERE status='OPEN') AS open_messages,
        (SELECT COALESCE(SUM(file_size),0) FROM photos) AS photo_bytes,
        (SELECT COALESCE(SUM(output_bytes),0) FROM video_projects) AS video_bytes
        """) Overview overview();
    @Update("""
        UPDATE users SET user_level=#{r.userLevel},trip_limit=#{r.tripLimit},trip_retention_months=#{r.tripRetentionMonths},
        can_share=#{r.canShare},can_video=#{r.canVideo},custom_music_access=#{r.customMusicAccess},status=#{r.status},
        updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at))
        WHERE id=#{id} AND role='USER'
        """) int updateUser(@Param("id") Long id,@Param("r") UpdateUserRequest r);
    @Insert("INSERT INTO admin_audit_logs(admin_id,user_id,action,details,created_at) VALUES(#{adminId},#{userId},#{action},#{details},UTC_TIMESTAMP(6))")
    int audit(@Param("adminId") Long adminId,@Param("userId") Long userId,@Param("action") String action,@Param("details") String details);
    @Select("SELECT COUNT(*) FROM admin_audit_logs WHERE admin_id=#{adminId} AND action<>'MAINTENANCE_FINISHED' AND created_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE)")
    int recentPermissionUpdates(Long adminId);
    @Select("SELECT COUNT(*) FROM support_messages WHERE user_id=#{userId} AND created_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY)") int dailyMessages(Long userId);
    @Insert("INSERT INTO support_messages(user_id,subject,content,created_at) VALUES(#{userId},#{subject},#{content},UTC_TIMESTAMP(6))")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertMessage(MessageView m);
    String MESSAGES = "SELECT m.*,u.email,u.nickname FROM support_messages m JOIN users u ON u.id=m.user_id ";
    @Select(MESSAGES+"WHERE m.user_id=#{userId} ORDER BY m.id DESC LIMIT 100") List<MessageView> messages(Long userId);
    @Select(MESSAGES+"WHERE (#{status}='' OR m.status=#{status}) ORDER BY m.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<MessageView> allMessages(@Param("status") String status,@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM support_messages WHERE (#{status}='' OR status=#{status})") long messageCount(String status);
    @Select(MESSAGES+"WHERE m.id=#{id}") MessageView message(Long id);
    @Select("SELECT id FROM support_messages WHERE id=#{id} FOR UPDATE") Long lockMessage(Long id);
    @Update("UPDATE support_messages SET reply=#{reply},status='REPLIED',replied_at=UTC_TIMESTAMP(6) WHERE id=#{id}")
    int reply(@Param("id") Long id,@Param("reply") String reply);
}
