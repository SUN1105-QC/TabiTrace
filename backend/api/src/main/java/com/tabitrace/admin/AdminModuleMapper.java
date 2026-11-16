package com.tabitrace.admin;

import com.tabitrace.admin.AdminModuleDtos.*;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface AdminModuleMapper {
    @Select("SELECT * FROM admin_registration_defaults WHERE id=1") Defaults defaults();
    @Select("SELECT * FROM admin_registration_defaults WHERE id=1 FOR UPDATE") Defaults lockDefaults();
    @Update("""
        UPDATE admin_registration_defaults SET user_level=#{userLevel},trip_limit=#{tripLimit},trip_retention_months=#{tripRetentionMonths},
        can_share=#{canShare},can_video=#{canVideo},custom_music_access=#{customMusicAccess},
        updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=1
        """) int saveDefaults(DefaultsRequest r);
    String INVITES="SELECT i.id,i.email,i.nickname,i.created_by,i.created_at,i.updated_at,u.id AS user_id,CASE WHEN i.status='PENDING' AND u.id IS NOT NULL THEN 'ACCEPTED' ELSE i.status END AS status FROM admin_user_invitations i LEFT JOIN users u ON u.email=i.email ";
    @Update("UPDATE admin_user_invitations SET status='ACCEPTED',updated_at=UTC_TIMESTAMP(6) WHERE email=#{email} AND status='PENDING'") int acceptInvitation(String email);
    @Select(INVITES+"ORDER BY i.id DESC LIMIT #{limit} OFFSET #{offset}") List<Invitation> invitations(@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM admin_user_invitations") long invitationCount();
    @Select("SELECT * FROM admin_user_invitations WHERE id=#{id} FOR UPDATE") Invitation lockInvitation(Long id);
    @Select("SELECT * FROM admin_user_invitations WHERE email=#{email} AND status='PENDING' FOR UPDATE") Invitation pendingInvitation(String email);
    @Insert("INSERT INTO admin_user_invitations(email,nickname,created_by,created_at,updated_at) VALUES(#{email},#{nickname},#{createdBy},UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertInvitation(Invitation i);
    @Update("UPDATE admin_user_invitations SET status='REVOKED',updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='PENDING'") int revokeInvitation(Long id);
    @Update("UPDATE admin_user_invitations SET updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int touchInvitation(Long id);
    @Update("""
        UPDATE users SET deletion_previous_status=status,deletion_requested_by_admin=TRUE,status='DELETION_PENDING',
        deletion_requested_at=UTC_TIMESTAMP(6),deletion_scheduled_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY),
        updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id} AND role='USER' AND status IN ('ACTIVE','DISABLED')
        """) int deleteUser(Long id);
    @Update("""
        UPDATE users SET status=COALESCE(deletion_previous_status,'ACTIVE'),deletion_previous_status=NULL,deletion_requested_by_admin=FALSE,
        deletion_requested_at=NULL,deletion_scheduled_at=NULL,updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at))
        WHERE id=#{id} AND role='USER' AND status='DELETION_PENDING'
        """) int restoreUser(Long id);

    String TRIPS="SELECT t.id,t.user_id,t.title,t.destination_name,t.status,t.visibility,t.created_at,t.updated_at,t.expires_at,(t.expires_at<=UTC_TIMESTAMP(6)) AS expired,u.email,u.nickname,"
            +"(SELECT COUNT(*) FROM photos p WHERE p.trip_id=t.id) AS photos,(SELECT COUNT(*) FROM checkins c WHERE c.trip_id=t.id) AS checkins,"
            +"(SELECT COUNT(*) FROM share_links s WHERE s.trip_id=t.id AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>UTC_TIMESTAMP(6))) AS active_shares FROM trips t JOIN users u ON u.id=t.user_id ";
    String TRIP_FILTER="WHERE (#{q}='' OR LOCATE(#{q},t.title)>0 OR LOCATE(#{q},u.email)>0 OR LOCATE(#{q},t.destination_name)>0) AND (#{status}='' OR (#{status}='EXPIRED' AND t.expires_at<=UTC_TIMESTAMP(6)) OR (t.status=#{status} AND t.expires_at>UTC_TIMESTAMP(6))) ";
    @Select(TRIPS+TRIP_FILTER+"ORDER BY t.id DESC LIMIT #{limit} OFFSET #{offset}") List<Trip> trips(@Param("q") String q,@Param("status") String status,@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM trips t JOIN users u ON u.id=t.user_id "+TRIP_FILTER) long tripCount(@Param("q") String q,@Param("status") String status);
    @Select(TRIPS+"WHERE t.id=#{id}") Trip trip(Long id);
    @Update("UPDATE trips SET updated_at=GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,updated_at)) WHERE id=#{id}") int touchTrip(Long id);
    @Update("UPDATE share_links SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6) WHERE trip_id=#{id} AND status='ACTIVE'") int revokeShares(Long id);

    // UNION 分支由常量构成；kind/q/status 只能作为绑定值，绝不拼接客户端表名或排序 SQL。
    String MEDIA="""
        SELECT p.id,p.user_id,p.trip_id,p.file_size,u.email,CONCAT('照片 #',p.id) AS title,'READY' AS status,'PHOTO' AS kind,p.created_at,p.created_at AS updated_at FROM photos p JOIN users u ON u.id=p.user_id
        UNION ALL SELECT v.id,v.user_id,v.trip_id,v.output_bytes AS file_size,u.email,CONCAT(t.title,' · 视频 #',v.id) AS title,v.status,'VIDEO' AS kind,v.created_at,v.updated_at FROM video_projects v JOIN users u ON u.id=v.user_id JOIN trips t ON t.id=v.trip_id
        UNION ALL SELECT m.id,m.user_id,NULL AS trip_id,m.file_size,u.email,m.title,m.status,'MUSIC' AS kind,m.created_at,m.updated_at FROM user_music m JOIN users u ON u.id=m.user_id
        """;
    String MEDIA_FILTER=" WHERE (#{kind}='' OR x.kind=#{kind}) AND (#{status}='' OR x.status=#{status}) AND (#{q}='' OR LOCATE(#{q},x.title)>0 OR LOCATE(#{q},x.email)>0) ";
    @Select("SELECT x.* FROM ("+MEDIA+") x"+MEDIA_FILTER+"ORDER BY x.created_at DESC,x.kind,x.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<Media> media(@Param("kind") String kind,@Param("q") String q,@Param("status") String status,@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM ("+MEDIA+") x"+MEDIA_FILTER) long mediaCount(@Param("kind") String kind,@Param("q") String q,@Param("status") String status);
    @Select("SELECT x.* FROM ("+MEDIA+") x WHERE x.kind=#{kind} AND x.id=#{id}") Media medium(@Param("kind") String kind,@Param("id") Long id);
    @Select("SELECT id FROM photos WHERE id=#{id} FOR UPDATE") Long lockPhoto(Long id);
    @Select("SELECT id FROM video_projects WHERE id=#{id} FOR UPDATE") Long lockVideo(Long id);
    @Select("SELECT id FROM user_music WHERE id=#{id} FOR UPDATE") Long lockMusic(Long id);

    String AUDIT_FILTER=" WHERE (#{q}='' OR LOCATE(#{q},action)>0 OR LOCATE(#{q},details)>0 OR CAST(user_id AS CHAR)=#{q}) ";
    @Select("SELECT * FROM admin_audit_logs"+AUDIT_FILTER+"ORDER BY id DESC LIMIT #{limit} OFFSET #{offset}") List<Audit> audit(@Param("q") String q,@Param("offset") int offset,@Param("limit") int limit);
    @Select("SELECT COUNT(*) FROM admin_audit_logs"+AUDIT_FILTER) long auditCount(String q);
    @Select("""
        SELECT (SELECT COUNT(*) FROM trips WHERE expires_at<=UTC_TIMESTAMP(6)) AS expired_trips,
        (SELECT COUNT(*) FROM users WHERE status='DELETION_PENDING' AND deletion_scheduled_at<=UTC_TIMESTAMP(6)) AS due_accounts,
        (SELECT COUNT(*) FROM user_music WHERE status IN ('DELETED','FAILED') AND purged_at IS NULL) AS music_files,
        (SELECT COUNT(*) FROM video_output_deletions) AS pending_video_files
        """) Maintenance maintenance();
    @Select("SELECT * FROM admin_maintenance_jobs ORDER BY id DESC LIMIT 25") List<Job> jobs();
    @Insert("INSERT INTO admin_maintenance_jobs(kind,requested_by,created_at) VALUES(#{kind},#{requestedBy},UTC_TIMESTAMP(6))")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertJob(Job j);
    @Select("SELECT * FROM admin_maintenance_jobs WHERE id=#{id}") Job job(Long id);
    @Select("SELECT * FROM admin_maintenance_jobs WHERE status='QUEUED' ORDER BY id LIMIT 1") Job queuedJob();
    @Update("UPDATE admin_maintenance_jobs SET status='RUNNING',started_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='QUEUED'") int claimJob(Long id);
    @Update("UPDATE admin_maintenance_jobs SET status=#{status},result=#{result},completed_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='RUNNING'")
    int finishJob(@Param("id") Long id,@Param("status") String status,@Param("result") String result);
    @Update("UPDATE admin_maintenance_jobs SET status='FAILED',result='服务重启中断，请检查待清理数据后重新提交',completed_at=UTC_TIMESTAMP(6) WHERE status='RUNNING'") int recoverJobs();
}
