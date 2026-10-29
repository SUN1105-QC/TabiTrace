package com.tabitrace.cost;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class CostMonitor {
    private final CostMapper mapper;
    private final CostControlService service;
    private final int batch;
    private long cursor;
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(CostMonitor.class);
    public CostMonitor(CostMapper mapper,CostControlService service,@Value("${app.cost.scan-batch-size:100}")int batch){this.mapper=mapper;this.service=service;this.batch=Math.max(1,Math.min(batch,500));}
    @Scheduled(fixedDelayString="${app.cost.scan-interval-ms:900000}",initialDelayString="${app.cost.scan-interval-ms:900000}")
    public void scan(){
        var ids=mapper.scanUsers(cursor,batch);
        if(ids.isEmpty()){cursor=0;return;}
        for(Long id:ids){try{service.observeStorage(id);}catch(Exception e){log.warn("COST observation failed account={} reason={}",id,e.getClass().getSimpleName());}cursor=id;}
    }
}
