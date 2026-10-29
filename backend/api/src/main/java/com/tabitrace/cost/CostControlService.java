package com.tabitrace.cost;

import com.tabitrace.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.Map;

@Service
public class CostControlService {
    private final CostMapper mapper;
    private final CostProperties props;
    private final Clock clock;
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(CostControlService.class);
    @org.springframework.beans.factory.annotation.Autowired
    public CostControlService(CostMapper mapper,CostProperties props){this(mapper,props,Clock.systemUTC());}
    public CostControlService(CostMapper mapper,CostProperties props,Clock clock){this.mapper=mapper;this.props=props;this.clock=clock.withZone(ZoneOffset.UTC);}
    public record Limits(boolean enforced,long dailyRenders,long dailyOutputSeconds){}
    public record Media(long photoBytes,long musicReservedBytes,long videoBytes,long variantEstimateBytes,long unknownPhotos,long unknownVideos){}
    public record Usage(LocalDate day,long renderRequests,long outputSeconds,long activeRenders,Limits limits,Media media){}

    /** Must be the first DB operation in VideoService.render, before its active-count snapshot. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void lockRendering(Long userId){
        if(mapper.lockGlobal()==null)throw new IllegalStateException("Missing video-render lock migration");
        if(mapper.lockUser(userId)==null)throw new BusinessException("USER_NOT_FOUND","账号不存在",HttpStatus.NOT_FOUND);
        if(props.isEnforce()&&props.getGlobalActiveRenders()>0&&mapper.activeGlobal()>=props.getGlobalActiveRenders())
            throw new BusinessException("VIDEO_GLOBAL_QUEUE_LIMIT","视频生成队列已满，请稍后再试",HttpStatus.TOO_MANY_REQUESTS,Map.of("retryAfter",30));
    }

    /** Queue transition and usage reservation share the caller's transaction. Failed validation consumes nothing. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void reserveRender(Long userId,int seconds){
        if(seconds<=0)throw new IllegalArgumentException("Invalid render duration");
        LocalDate day=LocalDate.now(clock); String scope="user:"+userId;
        mapper.ensureDaily("global",day,null); mapper.ensureDaily(scope,day,userId);
        CostMapper.Daily global=mapper.lockDaily("global",day),account=mapper.lockDaily(scope,day);
        if(props.isEnforce()){
            check(account,props.getAccountDailyRenders(),props.getAccountDailySeconds(),seconds);
            check(global,props.getGlobalDailyRenders(),props.getGlobalDailySeconds(),seconds);
        }
        mapper.increment("global",day,seconds);mapper.increment(scope,day,seconds);
        warn(scope,day,"DAILY_RENDERS",Math.addExact(account.renderCount,1),props.getWarnDailyRenders());
        warn(scope,day,"DAILY_OUTPUT_SECONDS",Math.addExact(account.outputSeconds,seconds),props.getWarnDailySeconds());
        warn("global",day,"DAILY_RENDERS",Math.addExact(global.renderCount,1),props.getWarnGlobalDailyRenders());
        warn("global",day,"DAILY_OUTPUT_SECONDS",Math.addExact(global.outputSeconds,seconds),props.getWarnGlobalDailySeconds());
    }
    private void check(CostMapper.Daily used,long renders,long seconds,int next){
        if((renders>0&&used.renderCount>=renders)||(seconds>0&&(used.outputSeconds>seconds-next))){
            long retry=Duration.between(clock.instant(),LocalDate.now(clock).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()).toSeconds();
            throw new BusinessException("VIDEO_DAILY_BUDGET","今日视频生成额度已用完，请明天再试",HttpStatus.TOO_MANY_REQUESTS,Map.of("retryAfter",Math.max(1,retry)));
        }
    }
    public Usage usage(Long userId){
        CostMapper.Daily d=mapper.daily("user:"+userId,LocalDate.now(clock)); CostMapper.Storage s=mapper.storage(userId);
        return new Usage(LocalDate.now(clock),d==null?0:d.renderCount,d==null?0:d.outputSeconds,mapper.activeUser(userId),
                new Limits(props.isEnforce(),props.getAccountDailyRenders(),props.getAccountDailySeconds()),
                new Media(s.photoBytes,s.musicBytes,s.videoBytes,s.variantEstimateBytes,s.unknownPhotos,s.unknownVideos));
    }
    public void observeStorage(Long userId){
        CostMapper.Storage s=mapper.storage(userId);
        long estimate=Math.addExact(Math.addExact(s.photoBytes,s.musicBytes),Math.addExact(s.videoBytes,s.variantEstimateBytes));
        warn("user:"+userId,LocalDate.now(clock),"REGISTERED_MEDIA_ESTIMATE",estimate,props.getWarnStorageBytes());
    }
    private void warn(String scope,LocalDate day,String kind,long value,long threshold){
        if(threshold>0&&value>=threshold&&mapper.alert(scope,day,kind,value,threshold)==1)
            log.warn("COST threshold scope={} day={} resource={} observed={} threshold={}",scope,day,kind,value,threshold);
    }
}
