package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.city.mapper.OfficialCityMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.itinerary.mapper.ItineraryMapper;
import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.photo.storage.StorageService;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.dto.TripDtos.CreateTripRequest;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.*;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import com.tabitrace.video.mapper.VideoProjectMapper;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.*;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;
import java.util.zip.ZipInputStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** All migrations and SQL run against fresh random-prefixed tables, never business tables. */
@EnabledIfEnvironmentVariable(named="ADMIN_TEST_DB_URL",matches=".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MySqlAdminIntegrationTest {
    final String prefix="admtest_"+UUID.randomUUID().toString().replace("-","").substring(0,10)+"_";
    final Set<String> tables=new LinkedHashSet<>();
    final StorageService storage=mock(StorageService.class);
    final com.tabitrace.mail.MailService mail=mock(com.tabitrace.mail.MailService.class);
    final com.tabitrace.photo.service.PhotoService photoService=mock(com.tabitrace.photo.service.PhotoService.class);
    final com.tabitrace.video.service.VideoService videoService=mock(com.tabitrace.video.service.VideoService.class);
    final com.tabitrace.usermusic.service.UserMusicService musicService=mock(com.tabitrace.usermusic.service.UserMusicService.class);
    JdbcTemplate jdbc;AnnotationConfigApplicationContext context;
    UserMapper users;TripMapper tripMapper;TripService trips;AdminMapper mapper;AdminService admin;
    SupportService support;TripDeletionService deletion;TripExportService export;MembershipService membership;
    long adminId;

    String sql(String source){
        if(!prefix.matches("admtest_[a-f0-9]{10}_"))throw new IllegalStateException("Unsafe prefix");
        var matcher=Pattern.compile("(?i)(\\b(?:FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES|ON)\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?)([a-z_][a-z0-9_]*)").matcher(source);
        String rewritten=matcher.replaceAll(m->m.group(1)+(tables.contains(m.group(2).toLowerCase())?prefix:"")+m.group(2));
        return rewritten.replaceAll("\\b((?:fk_|idx_|uk_|chk_)[a-zA-Z0-9_]+)\\b",prefix+"$1");
    }
    @BeforeAll void start()throws Exception{
        String url=System.getenv("ADMIN_TEST_DB_URL");
        if(!url.matches("jdbc:mysql://(?:127\\.0\\.0\\.1|localhost)(?::[0-9]+)?/[^/?]+(?:\\?.*)?"))throw new IllegalArgumentException("Loopback MySQL only");
        var ds=new DriverManagerDataSource(url,System.getenv().getOrDefault("ADMIN_TEST_DB_USER","tabitrace_app"),System.getenv("ADMIN_TEST_DB_PASSWORD"));
        jdbc=new JdbcTemplate(ds);
        var dir=Path.of(System.getProperty("basedir"),"src/main/resources/db/migration");
        List<Path> migrations;
        try(var paths=Files.list(dir)){migrations=paths.sorted(Comparator.comparingInt(p->Integer.parseInt(p.getFileName().toString().split("__")[0].substring(1)))).toList();}
        for(var p:migrations){var m=Pattern.compile("(?i)CREATE TABLE\\s+([a-z_]+)").matcher(Files.readString(p));while(m.find())tables.add(m.group(1));}
        try{
            for(var p:migrations){new ResourceDatabasePopulator(new ByteArrayResource(sql(Files.readString(p)).getBytes(StandardCharsets.UTF_8))).execute(ds);}
            var factory=new SqlSessionFactoryBean();factory.setDataSource(ds);factory.setPlugins(new PrefixSql(this));
            var cfg=new org.apache.ibatis.session.Configuration();cfg.setMapUnderscoreToCamelCase(true);
            List<Class<?>> mappers=List.of(UserMapper.class,TripMapper.class,AdminMapper.class,AdminModuleMapper.class,RefreshTokenMapper.class,PhotoMapper.class,VideoProjectMapper.class,
                    CheckinMapper.class,ItineraryMapper.class,PlaceMapper.class,TripPlaceMapper.class,OfficialCityMapper.class,MembershipMapper.class,
                    com.tabitrace.memory.mapper.MemoryMapper.class);
            for(var type:mappers)cfg.addMapper(type);factory.setConfiguration(cfg);
            var template=new SqlSessionTemplate(Objects.requireNonNull(factory.getObject()));
            context=new AnnotationConfigApplicationContext();context.registerBean(DataSource.class,()->ds);
            for(var type:mappers)registerMapper(type,template);
            context.registerBean(StorageService.class,()->storage);context.registerBean(ObjectMapper.class,()->new ObjectMapper());
            context.registerBean(com.tabitrace.mail.MailService.class,()->mail);
            context.registerBean(com.tabitrace.photo.service.PhotoService.class,()->photoService);
            context.registerBean(com.tabitrace.video.service.VideoService.class,()->videoService);
            context.registerBean(com.tabitrace.usermusic.service.UserMusicService.class,()->musicService);
            context.register(TxConfig.class,TripService.class,AdminService.class,AdminModuleService.class,RegistrationDefaultsService.class,SupportService.class,TripDeletionService.class,TripExportService.class,MembershipService.class);
            context.refresh();users=context.getBean(UserMapper.class);tripMapper=context.getBean(TripMapper.class);trips=context.getBean(TripService.class);
            mapper=context.getBean(AdminMapper.class);admin=context.getBean(AdminService.class);support=context.getBean(SupportService.class);
            deletion=context.getBean(TripDeletionService.class);export=context.getBean(TripExportService.class);membership=context.getBean(MembershipService.class);
            adminId=users.findByEmail("sunqingchuan1105@gmail.com").id;
        }catch(Exception|AssertionError ex){cleanup();throw ex;}
    }
    <T> void registerMapper(Class<T> type,SqlSessionTemplate template){context.registerBean(type,()->template.getMapper(type));}
    @Configuration @EnableTransactionManagement static class TxConfig{
        @Bean PlatformTransactionManager transactionManager(DataSource ds){return new DataSourceTransactionManager(ds);}
    }
    @Intercepts(@Signature(type=StatementHandler.class,method="prepare",args={Connection.class,Integer.class}))
    static class PrefixSql implements Interceptor{
        final MySqlAdminIntegrationTest owner;PrefixSql(MySqlAdminIntegrationTest owner){this.owner=owner;}
        public Object intercept(Invocation invocation)throws Throwable{var h=(StatementHandler)invocation.getTarget();SystemMetaObject.forObject(h.getBoundSql()).setValue("sql",owner.sql(h.getBoundSql().getSql()));return invocation.proceed();}
    }
    @AfterAll void cleanup(){
        if(context!=null)context.close();
        if(jdbc!=null)jdbc.execute((ConnectionCallback<Void>)c->{try(var s=c.createStatement()){
            s.execute("SET FOREIGN_KEY_CHECKS=0");
            try{for(String t:tables){
                String target=prefix+t;
                if(!target.matches("admtest_[a-f0-9]{10}_[a-z_]+"))throw new IllegalStateException("Unsafe cleanup table");
                s.execute("DROP TABLE IF EXISTS "+target);
            }}finally{s.execute("SET FOREIGN_KEY_CHECKS=1");}
        }return null;});
    }
    @BeforeEach void resetStorage(){reset(storage,mail,photoService,videoService,musicService);}
    UserEntity user(){var u=new UserEntity();u.email=UUID.randomUUID()+"@example.invalid";u.passwordHash="test-only";u.nickname="测试用户";u.locale="zh-CN";u.timezone="Asia/Tokyo";u.defaultVisibility="PRIVATE";u.emailNotifications=false;users.insert(u);return users.findById(u.id);}
    CreateTripRequest request(){return new CreateTripRequest("测试旅程","东京",null,null,LocalDate.now(),LocalDate.now(),1,null,false);}
    UpdateUserRequest policy(Long id,int limit,int months,String music,String status){return new UpdateUserRequest("升级用户",limit,months,true,true,music,status,users.findById(id).updatedAt);}

    @Test void singletonAdminAndOrdinaryDefaultsAreEnforcedByTheDatabase(){
        assertEquals(1L,jdbc.queryForObject(sql("SELECT COUNT(*) FROM users WHERE role='ADMIN'"),Long.class));
        var seeded=users.findById(adminId);assertTrue(seeded.passwordHash.startsWith("$2a$12$"));
        var u=user();assertEquals("USER",u.role);assertEquals(20,u.tripLimit);assertEquals(1,u.tripRetentionMonths);
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update(sql("UPDATE users SET role='ADMIN' WHERE id=?"),u.id));
        assertThrows(BusinessException.class,()->admin.update(u.id,u.id,policy(u.id,999,120,"ALLOW","ACTIVE")));
        assertThrows(BusinessException.class,()->admin.update(adminId,adminId,policy(u.id,999,120,"ALLOW","ACTIVE")));
        assertThrows(BusinessException.class,()->trips.create(adminId,request()));
    }
    @Test void concurrentCreationCannotExceedTwentyEvenWithArchivedOrProTrips()throws Exception{
        var u=user();for(int i=0;i<19;i++)trips.create(u.id,request());
        jdbc.update(sql("UPDATE trips SET status='ARCHIVED',plan_type='PRO' WHERE user_id=?"),u.id);
        try(var executor=Executors.newFixedThreadPool(6)){
            var gate=new CountDownLatch(1);List<Future<Boolean>> work=new ArrayList<>();
            for(int i=0;i<6;i++)work.add(executor.submit(()->{gate.await();try{trips.create(u.id,request());return true;}catch(BusinessException ex){assertEquals("TRIP_LIMIT_REACHED",ex.getCode());return false;}}));
            gate.countDown();int successes=0;for(var f:work)if(f.get(30,TimeUnit.SECONDS))successes++;
            assertEquals(1,successes);assertEquals(20,tripMapper.countLiveTrips(u.id));
        }
    }
    @Test void upgradesExtendLiveTripsButNeverResurrectExpiredTrips(){
        var u=user();var live=trips.create(u.id,request());var old=trips.create(u.id,request());
        jdbc.update(sql("UPDATE trips SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),status='ARCHIVED' WHERE id=?"),old.id());
        admin.update(adminId,u.id,policy(u.id,50,12,"ALLOW","ACTIVE"));
        assertEquals(live.createdAt().plusMonths(12),tripMapper.findById(live.id()).expiresAt);
        assertEquals("TRIP_EXPIRED",assertThrows(BusinessException.class,()->trips.get(u.id,old.id())).getCode());
        assertTrue(context.getBean(com.tabitrace.memory.mapper.MemoryMapper.class).archivedTrips(u.id).isEmpty());
        assertEquals("ADMIN",membership.current(u.id).source());assertTrue(membership.current(u.id).active());
        admin.update(adminId,u.id,policy(u.id,50,12,"DENY","DISABLED"));
        assertFalse(membership.current(u.id).active());assertEquals("DISABLED",users.findById(u.id).status);
        assertEquals("FEATURE_DISABLED",assertThrows(BusinessException.class,()->membership.require(u.id,"CUSTOM_MUSIC")).getCode());
        assertThrows(BusinessException.class,()->trips.create(u.id,request()));
    }
    @Test void userMessagesArePrivateRateLimitedAndReplyable(){
        var u=user();var other=user();
        var m=support.send(u.id,new MessageRequest("申请升级","希望保留十二个月"));
        assertTrue(support.list(other.id).isEmpty());assertEquals(1,support.list(u.id).size());
        assertThrows(BusinessException.class,()->support.reply(other.id,m.id,new ReplyRequest("越权")));
        support.reply(adminId,m.id,new ReplyRequest("已调整，请查看账号配额"));
        assertEquals("REPLIED",support.list(u.id).getFirst().status);
        for(int i=0;i<9;i++)support.send(u.id,new MessageRequest("申请","内容"));
        assertEquals("MESSAGE_LIMIT",assertThrows(BusinessException.class,()->support.send(u.id,new MessageRequest("申请","内容"))).getCode());
        assertNotNull(admin.overview(adminId));assertEquals(1,admin.users(adminId,u.email,1).items().size());
        var page=support.inboxPage(adminId,"REPLIED",1);
        assertTrue(page.total()>=1);assertTrue(page.items().stream().allMatch(row->"REPLIED".equals(row.status)));
    }
    @Test void filtersDetailsAndStaleEditsUseAuthoritativeDatabaseValues(){
        var a=user();var b=user();String marker="qa-"+UUID.randomUUID();
        jdbc.update(sql("UPDATE users SET nickname=? WHERE id=?"),marker+"A",a.id);
        jdbc.update(sql("UPDATE users SET nickname=? WHERE id=?"),marker+"B",b.id);
        admin.update(adminId,b.id,policy(b.id,20,1,"DENY","DISABLED"));
        var filtered=admin.users(adminId,marker,"DISABLED",1,10);
        assertEquals(1,filtered.total());assertEquals(b.id,filtered.items().getFirst().id());assertEquals(10,filtered.pageSize());
        var detail=admin.user(adminId,a.id);var original=policy(a.id,50,12,"ALLOW","ACTIVE");
        var saved=admin.update(adminId,a.id,original);
        assertNotEquals(detail.updatedAt(),saved.updatedAt());assertEquals(50,saved.tripLimit());
        assertEquals("ADMIN_USER_CHANGED",assertThrows(BusinessException.class,()->admin.update(adminId,a.id,original)).getCode());
        assertEquals(50,admin.user(adminId,a.id).tripLimit());
    }
    @Test void simultaneousTabsCannotOverwriteOneAnother()throws Exception{
        var u=user();var input=policy(u.id,30,2,"ALLOW","ACTIVE");
        try(var executor=Executors.newFixedThreadPool(2)){
            var gate=new CountDownLatch(1);List<Future<Boolean>> work=new ArrayList<>();
            for(int i=0;i<2;i++)work.add(executor.submit(()->{gate.await();try{admin.update(adminId,u.id,input);return true;}catch(BusinessException ex){assertEquals("ADMIN_USER_CHANGED",ex.getCode());return false;}}));
            gate.countDown();int successes=0;for(var future:work)if(future.get(30,TimeUnit.SECONDS))successes++;
            assertEquals(1,successes);
        }
    }
    @Test void concurrentDifferentUsersStillRespectTheAdministratorWriteLimit()throws Exception{
        var a=user();var b=user();String marker="rate-"+UUID.randomUUID();
        int current=mapper.recentPermissionUpdates(adminId);
        try{
            for(int i=current;i<59;i++)mapper.audit(adminId,a.id,"UPDATE_USER",marker);
            var first=policy(a.id,30,2,"ALLOW","ACTIVE");var second=policy(b.id,30,2,"ALLOW","ACTIVE");
            try(var executor=Executors.newFixedThreadPool(2)){
                var gate=new CountDownLatch(1);List<Future<String>> work=new ArrayList<>();
                for(var id:List.of(a.id,b.id))work.add(executor.submit(()->{gate.await();try{admin.update(adminId,id,id.equals(a.id)?first:second);return "SUCCESS";}catch(BusinessException ex){return ex.getCode();}}));
                gate.countDown();List<String> outcomes=new ArrayList<>();for(var future:work)outcomes.add(future.get(30,TimeUnit.SECONDS));
                assertEquals(1,outcomes.stream().filter("SUCCESS"::equals).count());
                assertEquals(1,outcomes.stream().filter("ADMIN_UPDATE_LIMIT"::equals).count());
            }
        }finally{
            // 此 SQL 仍由 sql() 限定到本次随机前缀审计表，不影响任何业务审计。
            jdbc.update(sql("DELETE FROM admin_audit_logs WHERE details=? OR (action='UPDATE_USER' AND user_id IN (?,?))"),marker,a.id,b.id);
        }
    }
    @Test void expiryRemovesMediaAndCascadesRecordsAndRetriesStorageFailure(){
        var u=user();var t=trips.create(u.id,request());
        var place=new com.tabitrace.place.entity.PlaceEntity();place.name="私有地点";place.sourceType="CUSTOM";
        var placeMapper=context.getBean(PlaceMapper.class);placeMapper.insert(place);
        context.getBean(TripPlaceMapper.class).add(t.id(),place.id,1);
        jdbc.update(sql("INSERT INTO photos(user_id,trip_id,storage_key,image_url,mime_type,created_at) VALUES(?,?,'photo-key','url','image/jpeg',UTC_TIMESTAMP())"),u.id,t.id());
        jdbc.update(sql("INSERT INTO video_projects(user_id,trip_id,template_code,aspect_ratio,duration,music_code,status,created_at,updated_at) VALUES(?,?,'JOURNAL','9:16',30,'NONE','COMPLETED',UTC_TIMESTAMP(),UTC_TIMESTAMP())"),u.id,t.id());
        assertFalse(deletion.deleteExpired(u.id,t.id()));
        jdbc.update(sql("UPDATE trips SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE id=?"),t.id());
        doThrow(new BusinessException("STORAGE_DELETE_FAILED","retry")).when(storage).deletePrefix("users/"+u.id+"/trips/"+t.id()+"/");
        assertThrows(BusinessException.class,()->deletion.deleteExpired(u.id,t.id()));assertNotNull(tripMapper.findById(t.id()));
        reset(storage);assertTrue(deletion.deleteExpired(u.id,t.id()));assertNull(tripMapper.findById(t.id()));
        assertNull(placeMapper.findById(place.id));
        assertEquals(0,jdbc.queryForObject(sql("SELECT COUNT(*) FROM photos WHERE trip_id=?"),Integer.class,t.id()));
        assertEquals(1,jdbc.queryForObject(sql("SELECT COUNT(*) FROM video_output_deletions WHERE trip_id=?"),Integer.class,t.id()));
    }
    @Test void invitationsSendRealMailThroughTheExistingGatewayAndRollbackOnFailure(){
        var service=context.getBean(AdminModuleService.class);var module=context.getBean(AdminModuleMapper.class);String email=UUID.randomUUID()+"@example.invalid";
        var invitation=service.invite(adminId,new AdminModuleDtos.InvitationRequest(email,"受邀用户"));
        assertEquals("PENDING",invitation.status);verify(mail).send(eq(email),contains("注册邀请"),contains("/register"),anyString());
        assertNull(users.findByEmail(email)); // 邮件邀请不能绕过验证创建账号。
        assertEquals("INVITATION_EXISTS",assertThrows(BusinessException.class,()->service.invite(adminId,new AdminModuleDtos.InvitationRequest(email,"重复"))).getCode());
        assertEquals("INVITATION_COOLDOWN",assertThrows(BusinessException.class,()->service.invitationAction(adminId,invitation.id,"RESEND",new AdminModuleDtos.VersionRequest(invitation.updatedAt))).getCode());
        var revoked=service.invitationAction(adminId,invitation.id,"REVOKE",new AdminModuleDtos.VersionRequest(invitation.updatedAt));assertEquals("REVOKED",revoked.status);
        String failedEmail=UUID.randomUUID()+"@example.invalid";
        doThrow(new com.tabitrace.mail.MailDeliveryException("test failure",null)).when(mail).send(eq(failedEmail),anyString(),anyString(),anyString());
        assertEquals("EMAIL_SEND_FAILED",assertThrows(BusinessException.class,()->service.invite(adminId,new AdminModuleDtos.InvitationRequest(failedEmail,"失败"))).getCode());
        assertNull(module.pendingInvitation(failedEmail));
        String acceptedEmail=UUID.randomUUID()+"@example.invalid";service.invite(adminId,new AdminModuleDtos.InvitationRequest(acceptedEmail,"用户"));
        context.getBean(RegistrationDefaultsService.class).registered(acceptedEmail);
        assertNull(module.pendingInvitation(acceptedEmail));
    }
    @Test void administratorDeletionUsesCoolingOffRevokesSessionsAndRestoresPreviousDisabledState(){
        var service=context.getBean(AdminModuleService.class);var u=user();admin.update(adminId,u.id,policy(u.id,20,1,"DENY","DISABLED"));u=users.findById(u.id);var disabled=u;
        assertEquals("CONFIRMATION_REQUIRED",assertThrows(BusinessException.class,()->service.deleteUser(adminId,disabled.id,new AdminModuleDtos.DeleteUserRequest(disabled.updatedAt,"wrong@example.invalid"))).getCode());
        var pending=service.deleteUser(adminId,u.id,new AdminModuleDtos.DeleteUserRequest(u.updatedAt,u.email));
        assertEquals("DELETION_PENDING",pending.status());assertTrue(pending.deletionRequestedByAdmin());assertEquals("DISABLED",pending.deletionPreviousStatus());
        assertTrue(pending.deletionScheduledAt().isAfter(LocalDateTime.now(ZoneOffset.UTC).plusDays(6)));assertEquals(0,users.cancelDeletion(u.id));
        assertEquals("ADMIN_RESOURCE_CHANGED",assertThrows(BusinessException.class,()->service.restoreUser(adminId,disabled.id,new AdminModuleDtos.VersionRequest(disabled.updatedAt))).getCode());
        var restored=service.restoreUser(adminId,u.id,new AdminModuleDtos.VersionRequest(pending.updatedAt()));assertEquals("DISABLED",restored.status());assertFalse(restored.deletionRequestedByAdmin());assertNull(restored.deletionScheduledAt());
        var protectedAdmin=users.findById(adminId);
        assertEquals("ADMIN_PROTECTED",assertThrows(BusinessException.class,()->service.deleteUser(adminId,adminId,new AdminModuleDtos.DeleteUserRequest(protectedAdmin.updatedAt,protectedAdmin.email))).getCode());
    }
    @Test void newRegistrationDefaultsAreVersionedAndNeverRewriteExistingAccounts(){
        var service=context.getBean(AdminModuleService.class);var original=service.defaults(adminId);var old=user();
        var request=new AdminModuleDtos.DefaultsRequest("新默认",31,3,false,false,"DENY",original.updatedAt);
        try{
            var saved=service.defaults(adminId,request);assertNotEquals(original.updatedAt,saved.updatedAt);
            assertEquals("ADMIN_RESOURCE_CHANGED",assertThrows(BusinessException.class,()->service.defaults(adminId,request)).getCode());
            var fresh=new UserEntity();context.getBean(RegistrationDefaultsService.class).apply(fresh);assertEquals(31,fresh.tripLimit);assertFalse(fresh.canVideo);
            assertEquals(20,users.findById(old.id).tripLimit);assertTrue(users.findById(old.id).canVideo);
        }finally{var current=service.defaults(adminId);service.defaults(adminId,new AdminModuleDtos.DefaultsRequest(original.userLevel,original.tripLimit,original.tripRetentionMonths,original.canShare,original.canVideo,original.customMusicAccess,current.updatedAt));}
    }
    @Test void contentActionsUseVersionsAndExistingDeletionPipeline(){
        var service=context.getBean(AdminModuleService.class);var u=user();var t=trips.create(u.id,request());
        var row=service.trips(adminId,"", "",1).items().stream().filter(x->x.id.equals(t.id())).findFirst().orElseThrow();
        service.tripAction(adminId,t.id(),new AdminModuleDtos.TripAction("ARCHIVE",row.updatedAt,""));
        assertEquals("ARCHIVED",tripMapper.findById(t.id()).status);
        assertEquals("ADMIN_RESOURCE_CHANGED",assertThrows(BusinessException.class,()->service.tripAction(adminId,t.id(),new AdminModuleDtos.TripAction("DELETE",row.updatedAt,row.title))).getCode());
        var current=tripMapper.findById(t.id());
        doThrow(new BusinessException("STORAGE_DELETE_FAILED","retry")).when(storage).deletePrefix("users/"+u.id+"/trips/"+t.id()+"/");
        assertThrows(BusinessException.class,()->service.tripAction(adminId,t.id(),new AdminModuleDtos.TripAction("DELETE",current.updatedAt,current.title)));assertNotNull(tripMapper.findById(t.id()));
        reset(storage);service.tripAction(adminId,t.id(),new AdminModuleDtos.TripAction("DELETE",current.updatedAt,current.title));assertNull(tripMapper.findById(t.id()));
    }
    @Test void mediaListsAreBoundedFilterableAndDeriveOwnersOnTheServer(){
        var service=context.getBean(AdminModuleService.class);var u=user();var t=trips.create(u.id,request());
        jdbc.update(sql("INSERT INTO photos(user_id,trip_id,storage_key,image_url,mime_type,created_at) VALUES(?,?,'private-key','private-url','image/jpeg',UTC_TIMESTAMP(6))"),u.id,t.id());
        var result=service.media(adminId,"PHOTO",u.email,"READY",1);assertEquals(1,result.total());var m=result.items().getFirst();assertEquals(u.id,m.userId);assertEquals("PHOTO",m.kind);
        service.deleteMedia(adminId,"PHOTO",m.id,new AdminModuleDtos.MediaDelete(m.updatedAt,"删除"));verify(photoService).deleteForAdmin(u.id,m.id);
        assertThrows(BusinessException.class,()->service.media(u.id,"PHOTO","","",1));
        assertEquals("INVALID_FILTER",assertThrows(BusinessException.class,()->service.media(adminId,"users; DROP TABLE users","","",1)).getCode());
    }
    @Test void maintenanceJobsAreDurableExclusiveAndAuditIsQueryable(){
        var service=context.getBean(AdminModuleService.class);var module=context.getBean(AdminModuleMapper.class);
        assertThrows(BusinessException.class,()->service.enqueue(adminId,new AdminModuleDtos.JobRequest("ACCOUNTS","wrong")));
        var job=service.enqueue(adminId,new AdminModuleDtos.JobRequest("ACCOUNTS","清理到期数据"));assertEquals("QUEUED",job.status);
        assertEquals("MAINTENANCE_BUSY",assertThrows(BusinessException.class,()->service.enqueue(adminId,new AdminModuleDtos.JobRequest("TRIPS","清理到期数据"))).getCode());
        assertEquals(1,module.claimJob(job.id));assertEquals(0,module.claimJob(job.id));module.finishJob(job.id,"COMPLETED","isolated test");assertEquals("COMPLETED",module.job(job.id).status);
        assertTrue(service.audit(adminId,"jobId="+job.id,1).total()>0);assertNotNull(service.maintenance(adminId));
        assertThrows(BusinessException.class,()->service.audit(user().id,"",1));
    }
    @Test void exportContainsOriginalPhotosAndReportsMissingFiles()throws Exception{
        var u=user();var t=trips.create(u.id,request());
        jdbc.update(sql("INSERT INTO photos(user_id,trip_id,storage_key,image_url,mime_type,created_at) VALUES(?,?,'photo-key','url','image/jpeg',UTC_TIMESTAMP()),(?,?,'missing-key','url','image/jpeg',UTC_TIMESTAMP())"),u.id,t.id(),u.id,t.id());
        when(storage.read("photo-key")).thenReturn(new byte[]{1,2,3});when(storage.read("missing-key")).thenThrow(new BusinessException("MISSING","missing"));
        var out=new ByteArrayOutputStream();export.write(u.id,t.id(),out);
        Map<String,byte[]> files=new HashMap<>();try(var zip=new ZipInputStream(new ByteArrayInputStream(out.toByteArray()))){java.util.zip.ZipEntry entry;while((entry=zip.getNextEntry())!=null)files.put(entry.getName(),zip.readAllBytes());}
        assertTrue(files.containsKey("trip.json"));assertEquals(1,files.keySet().stream().filter(n->n.startsWith("photos/")).count());
        assertTrue(new String(files.get("export-report.json"),StandardCharsets.UTF_8).contains("\"savedPhotos\":1"));
        assertThrows(BusinessException.class,()->export.write(user().id,t.id(),new ByteArrayOutputStream()));
    }
}
