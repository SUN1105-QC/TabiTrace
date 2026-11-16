package com.tabitrace.admin;

import com.tabitrace.admin.AdminModuleDtos.*;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.mail.MailService;
import com.tabitrace.photo.service.PhotoService;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripDeletionService;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.usermusic.service.UserMusicService;
import com.tabitrace.video.service.VideoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminModuleService {
    private final AdminService admin;
    private final AdminMapper audit;
    private final AdminModuleMapper mapper;
    private final UserMapper users;
    private final RefreshTokenMapper sessions;
    private final MailService mail;
    private final TripMapper trips;
    private final TripService tripService;
    private final TripDeletionService tripDeletion;
    private final PhotoService photos;
    private final VideoService videos;
    private final UserMusicService music;
    private final String publicUrl;
    public AdminModuleService(AdminService admin,AdminMapper audit,AdminModuleMapper mapper,UserMapper users,
            RefreshTokenMapper sessions,MailService mail,TripMapper trips,TripService tripService,TripDeletionService tripDeletion,
            PhotoService photos,VideoService videos,UserMusicService music,@Value("${app.public-url:http://localhost:3000}") String publicUrl) {
        this.admin=admin;this.audit=audit;this.mapper=mapper;this.users=users;this.sessions=sessions;this.mail=mail;
        this.trips=trips;this.tripService=tripService;this.tripDeletion=tripDeletion;this.photos=photos;this.videos=videos;this.music=music;
        this.publicUrl=publicUrl.replaceAll("/$","");
    }
    static int offset(int page) {
        if(page<1||page>1000000)throw new BusinessException("INVALID_PAGE_FILTER","分页参数无效");
        return (page-1)*25;
    }
    static String query(String q) {
        if(q==null||q.length()>200)throw new BusinessException("INVALID_FILTER","搜索条件过长");
        return q.strip();
    }
    void record(Long adminId,Long userId,String action,String details) {
        audit.audit(adminId,userId,action,"requestId="+UUID.randomUUID()+";result=SUCCESS;"+details);
    }
    static void version(LocalDateTime expected,LocalDateTime current) {
        if(expected==null||!expected.equals(current))throw new BusinessException("ADMIN_RESOURCE_CHANGED","资料已更新，请重新加载后再操作",HttpStatus.CONFLICT);
    }
    private UserEntity lockUser(Long id) {
        var u=users.lockById(id);
        if(u==null)throw new BusinessException("USER_NOT_FOUND","用户不存在",HttpStatus.NOT_FOUND);
        if(!"USER".equals(u.role))throw new BusinessException("ADMIN_PROTECTED","唯一管理员不能删除或变更身份",HttpStatus.FORBIDDEN);
        return u;
    }
    public Page<Invitation> invitations(Long adminId,int page) {
        admin.requireAdmin(adminId);return new Page<>(mapper.invitations(offset(page),25),mapper.invitationCount(),page,25);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Invitation invite(Long adminId,InvitationRequest request) {
        admin.lockForWrite(adminId);
        String email=com.tabitrace.verification.service.EmailVerificationService.normalizeEmail(request.email());
        if(users.findByEmail(email)!=null)throw new BusinessException("EMAIL_EXISTS","该邮箱已经注册，请在用户列表搜索",HttpStatus.CONFLICT);
        if(mapper.pendingInvitation(email)!=null)throw new BusinessException("INVITATION_EXISTS","该邮箱已有邀请，请使用重发或撤销",HttpStatus.CONFLICT);
        var i=new Invitation();i.email=email;i.nickname=request.nickname().strip();i.createdBy=adminId;
        if(i.nickname.isBlank()||i.nickname.length()>30)throw new BusinessException("INVALID_NICKNAME","昵称须为 1～30 字");
        mapper.insertInvitation(i);
        sendInvitation(i);
        record(adminId,adminId,"INVITE_USER","invitationId="+i.id);
        return mapper.lockInvitation(i.id);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Invitation invitationAction(Long adminId,Long id,String action,VersionRequest request) {
        admin.lockForWrite(adminId);
        var i=mapper.lockInvitation(id);
        if(i==null)throw new BusinessException("INVITATION_NOT_FOUND","邀请不存在",HttpStatus.NOT_FOUND);
        version(request.expectedUpdatedAt(),i.updatedAt);
        if(!"PENDING".equals(i.status)||users.findByEmail(i.email)!=null)
            throw new BusinessException("INVITATION_CLOSED","邀请已完成或撤销，请刷新列表",HttpStatus.CONFLICT);
        if("RESEND".equals(action)) {
            if(i.updatedAt.isAfter(LocalDateTime.now(java.time.ZoneOffset.UTC).minusMinutes(1)))
                throw new BusinessException("INVITATION_COOLDOWN","请在上次发送一分钟后重发",HttpStatus.TOO_MANY_REQUESTS);
            sendInvitation(i);mapper.touchInvitation(id);
        } else if("REVOKE".equals(action))mapper.revokeInvitation(id);
        else throw new BusinessException("INVALID_ACTION","邀请操作无效");
        record(adminId,adminId,action+"_INVITATION","invitationId="+id);
        return mapper.lockInvitation(id);
    }
    private void sendInvitation(Invitation i) {
        String link=publicUrl+"/register";
        String text="你好，"+i.nickname+"。管理员邀请你加入旅迹 TabiTrace。请访问 "+link+"，使用本邮箱获取验证码并设置自己的密码。邀请不替代邮箱验证，也不会自动创建账号。如非本人需要，请忽略。";
        // 只使用纯文本内容填充 HTML，避免昵称中包含标签；失败异常会回滚邀请记录并返回真实错误。
        try { mail.send(i.email,"旅迹 TabiTrace · 注册邀请",text,"<p>"+org.springframework.web.util.HtmlUtils.htmlEscape(text)+"</p>"); }
        catch(com.tabitrace.mail.MailDeliveryException ex) { throw new BusinessException("EMAIL_SEND_FAILED","邀请邮件发送失败，请稍后重试",HttpStatus.SERVICE_UNAVAILABLE); }
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public AdminDtos.UserView deleteUser(Long adminId,Long id,DeleteUserRequest request) {
        admin.lockForWrite(adminId);var u=lockUser(id);version(request.expectedUpdatedAt(),u.updatedAt);
        if(!u.email.equalsIgnoreCase(request.confirmationEmail().strip()))throw new BusinessException("CONFIRMATION_REQUIRED","请填写此账号的完整邮箱确认");
        if(mapper.deleteUser(id)!=1)throw new BusinessException("ACCOUNT_DELETION_PENDING","账号已经在注销冷静期",HttpStatus.CONFLICT);
        sessions.revokeAll(id);record(adminId,id,"DELETE_USER","coolingOffDays=7;previousStatus="+u.status);
        return admin.user(adminId,id);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public AdminDtos.UserView restoreUser(Long adminId,Long id,VersionRequest request) {
        admin.lockForWrite(adminId);var u=lockUser(id);version(request.expectedUpdatedAt(),u.updatedAt);
        if(mapper.restoreUser(id)!=1)throw new BusinessException("ACCOUNT_NOT_PENDING","账号不在注销冷静期",HttpStatus.CONFLICT);
        sessions.revokeAll(id);record(adminId,id,"RESTORE_USER","restoredStatus="+(u.deletionPreviousStatus==null?"ACTIVE":u.deletionPreviousStatus));
        return admin.user(adminId,id);
    }
    public Defaults defaults(Long adminId) {admin.requireAdmin(adminId);return mapper.defaults();}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Defaults defaults(Long adminId,DefaultsRequest request) {
        admin.lockForWrite(adminId);var old=mapper.lockDefaults();version(request.expectedUpdatedAt(),old.updatedAt);
        // 服务层也验证，防止未来非 HTTP 调用绕过 Bean Validation。
        if(request.userLevel()==null||request.userLevel().isBlank()||request.userLevel().length()>40||request.tripLimit()<1||request.tripLimit()>100000
                ||request.tripRetentionMonths()<1||request.tripRetentionMonths()>1200||request.canShare()==null||request.canVideo()==null
                ||!Set.of("INHERIT","ALLOW","DENY").contains(request.customMusicAccess()==null?"":request.customMusicAccess()))
            throw new BusinessException("INVALID_DEFAULTS","默认权限字段不合法");
        mapper.saveDefaults(new DefaultsRequest(request.userLevel().strip(),request.tripLimit(),request.tripRetentionMonths(),request.canShare(),request.canVideo(),request.customMusicAccess(),request.expectedUpdatedAt()));
        record(adminId,adminId,"UPDATE_DEFAULTS","newAccountsOnly=true;before="+old.userLevel+","+old.tripLimit+","+old.tripRetentionMonths+";after="+request);
        return mapper.defaults();
    }
    public Page<Trip> trips(Long adminId,String q,String status,int page) {
        admin.requireAdmin(adminId);if(!Set.of("","PLANNING","ONGOING","COMPLETED","ARCHIVED","EXPIRED").contains(status))throw new BusinessException("INVALID_FILTER","旅程状态无效");
        return new Page<>(mapper.trips(query(q),status,offset(page),25),mapper.tripCount(query(q),status),page,25);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void tripAction(Long adminId,Long id,TripAction request) {
        admin.lockForWrite(adminId);var t=mapper.trip(id);
        if(t==null)throw new BusinessException("TRIP_NOT_FOUND","旅程不存在",HttpStatus.NOT_FOUND);
        // 和到期清理、配额修改采用相同的账号 → 旅行顺序，防止清理期间内容被重新使用。
        lockUser(t.userId);trips.lockOwner(id);var fresh=mapper.trip(id);
        if(fresh==null)throw new BusinessException("TRIP_NOT_FOUND","旅程已被清理",HttpStatus.NOT_FOUND);
        version(request.expectedUpdatedAt(),fresh.updatedAt);
        switch(request.action()) {
            case "ARCHIVE" -> {tripService.archive(t.userId,id);mapper.touchTrip(id);}
            case "UNARCHIVE" -> {tripService.unarchive(t.userId,id);mapper.touchTrip(id);}
            case "REVOKE_SHARES" -> {mapper.revokeShares(id);mapper.touchTrip(id);}
            case "DELETE" -> {
                if(!fresh.title.equals(request.confirmation()))throw new BusinessException("CONFIRMATION_REQUIRED","请填写完整旅程名称确认删除");
                // 已过期的数据也走相同的对象存储 / 视频清理流程；不改变到期时间使数据复活。
                if(fresh.expiresAt.isAfter(LocalDateTime.now(java.time.ZoneOffset.UTC)))tripDeletion.delete(t.userId,id);
                else tripDeletion.deleteExpired(t.userId,id);
            }
            default -> throw new BusinessException("INVALID_ACTION","旅程操作无效");
        }
        record(adminId,t.userId,"TRIP_"+request.action(),"tripId="+id);
    }
    public Page<Media> media(Long adminId,String kind,String q,String status,int page) {
        admin.requireAdmin(adminId);
        if(!Set.of("","PHOTO","VIDEO","MUSIC").contains(kind)||!Set.of("","READY","DRAFT","QUEUED","PROCESSING","COMPLETED","FAILED","UPLOADING","DELETED").contains(status))
            throw new BusinessException("INVALID_FILTER","媒体类型或状态无效");
        return new Page<>(mapper.media(kind,query(q),status,offset(page),25),mapper.mediaCount(kind,query(q),status),page,25);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void deleteMedia(Long adminId,String kind,Long id,MediaDelete request) {
        admin.lockForWrite(adminId);
        if(!Set.of("PHOTO","VIDEO","MUSIC").contains(kind))throw new BusinessException("INVALID_FILTER","媒体类型无效");
        var m=mapper.medium(kind,id);if(m==null)throw new BusinessException("MEDIA_NOT_FOUND","媒体不存在",HttpStatus.NOT_FOUND);
        lockUser(m.userId);if(m.tripId!=null)trips.lockOwner(m.tripId);
        switch(kind){case "PHOTO" -> mapper.lockPhoto(id);case "VIDEO" -> mapper.lockVideo(id);case "MUSIC" -> mapper.lockMusic(id);default -> throw new IllegalStateException();}
        // 动态状态重新读取；归属始终取自数据库，不接受客户端提交 ownerId。
        m=mapper.medium(kind,id);if(m==null)throw new BusinessException("MEDIA_NOT_FOUND","媒体已删除",HttpStatus.NOT_FOUND);
        version(request.expectedUpdatedAt(),m.updatedAt);
        if(!"删除".equals(request.confirmation()))throw new BusinessException("CONFIRMATION_REQUIRED","请填写“删除”确认");
        switch(kind){case "PHOTO" -> photos.deleteForAdmin(m.userId,id);case "VIDEO" -> videos.deleteForAdmin(m.userId,id);case "MUSIC" -> music.delete(m.userId,id);default -> throw new IllegalStateException();}
        record(adminId,m.userId,"DELETE_"+kind,"mediaId="+id+";fileCleanup=existingPipeline");
    }
    public Page<Audit> audit(Long adminId,String q,int page) {
        admin.requireAdmin(adminId);return new Page<>(mapper.audit(query(q),offset(page),25),mapper.auditCount(query(q)),page,25);
    }
    public Maintenance maintenance(Long adminId) {admin.requireAdmin(adminId);return mapper.maintenance();}
    public java.util.List<Job> jobs(Long adminId) {admin.requireAdmin(adminId);return mapper.jobs();}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Job enqueue(Long adminId,JobRequest request) {
        admin.lockForWrite(adminId);
        if(!Set.of("TRIPS","ACCOUNTS","MUSIC").contains(request.kind())||!"清理到期数据".equals(request.confirmation()))
            throw new BusinessException("CONFIRMATION_REQUIRED","请填写“清理到期数据”确认");
        var j=new Job();j.kind=request.kind();j.requestedBy=adminId;
        try{mapper.insertJob(j);}catch(DuplicateKeyException ex){throw new BusinessException("MAINTENANCE_BUSY","已有维护任务正在执行或排队",HttpStatus.CONFLICT);}
        record(adminId,adminId,"MAINTENANCE_QUEUED","jobId="+j.id+";kind="+j.kind);
        return mapper.job(j.id);
    }
}
