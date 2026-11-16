package com.tabitrace.admin;

import com.tabitrace.trip.service.TripExpiryService;
import com.tabitrace.user.service.AccountDeletionService;
import com.tabitrace.usermusic.service.UserMusicService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** 请求只入队；后台有界地调用已有清理流程，操作员关闭页面也不会取消或丢失结果。 */
@Component
public class AdminMaintenanceRunner {
    private static final Logger log=LoggerFactory.getLogger(AdminMaintenanceRunner.class);
    private final AdminModuleMapper mapper;
    private final AdminMapper audit;
    private final TripExpiryService trips;
    private final AccountDeletionService accounts;
    private final UserMusicService music;
    private final AtomicBoolean busy=new AtomicBoolean();
    private final ExecutorService executor=Executors.newSingleThreadExecutor(r->{var t=new Thread(r,"admin-maintenance");t.setDaemon(true);return t;});
    private volatile boolean ready;
    private record Completion(Long id,Long actor,String status,String result) {}
    private volatile Completion pendingCompletion;
    public AdminMaintenanceRunner(AdminModuleMapper mapper,AdminMapper audit,TripExpiryService trips,AccountDeletionService accounts,UserMusicService music){this.mapper=mapper;this.audit=audit;this.trips=trips;this.accounts=accounts;this.music=music;}
    @EventListener(ApplicationReadyEvent.class) public void recover(){mapper.recoverJobs();ready=true;}
    @Scheduled(fixedDelay=5000,initialDelay=10000) public void dispatch(){
        if(!ready||!busy.compareAndSet(false,true))return;
        try{
            flushCompletion();
            var job=mapper.queuedJob();
            if(job==null||mapper.claimJob(job.id)!=1){busy.set(false);return;}
            executor.submit(()->{
                String status="COMPLETED",result;
                try{
                    int count=switch(job.kind){case "TRIPS"->trips.purgeDue();case "ACCOUNTS"->accounts.purgeDue();case "MUSIC"->music.cleanup();default->throw new IllegalStateException("Invalid maintenance kind");};
                    var remaining=mapper.maintenance();
                    result=("MUSIC".equals(job.kind)?"本轮尝试清理 ":"本轮已清理 ")+count+" 项；当前待清理旅程 "+remaining.expiredTrips()+"，到期账号 "+remaining.dueAccounts()+"，音乐文件 "+remaining.musicFiles()+"。未完成项由原有任务继续重试。";
                }catch(RuntimeException ex){status="FAILED";result="本轮维护未完成，请检查服务日志后重试。";log.warn("ADMIN: maintenance failed jobId={} type={}",job.id,ex.getClass().getSimpleName());}
                // 结果写入遇到暂时性数据库故障时，后续调度重试保存，不能让任务永久卡在 RUNNING。
                pendingCompletion=new Completion(job.id,job.requestedBy,status,result);
                try{flushCompletion();}catch(RuntimeException ex){log.warn("ADMIN: maintenance result will retry jobId={}",job.id);}
                finally{busy.set(false);}
            });
        }catch(RuntimeException ex){busy.set(false);log.warn("ADMIN: maintenance dispatch failed type={}",ex.getClass().getSimpleName());}
    }
    private void flushCompletion(){
        var completed=pendingCompletion;if(completed==null)return;
        mapper.finishJob(completed.id(),completed.status(),completed.result());
        pendingCompletion=null;
        try{audit.audit(completed.actor(),completed.actor(),"MAINTENANCE_FINISHED","jobId="+completed.id()+";result="+completed.status());}
        catch(RuntimeException ex){log.warn("ADMIN: maintenance completed but audit persistence failed jobId={}",completed.id());}
    }
    @PreDestroy public void shutdown(){ready=false;executor.shutdownNow();}
}
