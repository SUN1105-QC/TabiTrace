package com.tabitrace.cost;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;

@Component
@ConfigurationProperties(prefix="app.cost")
public class CostProperties {
    // Owner-approved defaults (2026-10-29). Environment variables can override each value.
    private boolean enforce=true;
    private long accountDailyRenders=20,accountDailySeconds=6000,globalDailyRenders=0,globalDailySeconds=0,globalActiveRenders=3;
    private long warnDailyRenders=20,warnDailySeconds=1200,warnStorageBytes=10L*1024*1024*1024;
    private long warnGlobalDailyRenders=200,warnGlobalDailySeconds=12000;
    public boolean isEnforce(){return enforce;}
    public void setEnforce(boolean v){enforce=v;}
    public long getAccountDailyRenders(){return accountDailyRenders;}
    public void setAccountDailyRenders(long v){accountDailyRenders=positive(v);}
    public long getAccountDailySeconds(){return accountDailySeconds;}
    public void setAccountDailySeconds(long v){accountDailySeconds=positive(v);}
    public long getGlobalDailyRenders(){return globalDailyRenders;}
    public void setGlobalDailyRenders(long v){globalDailyRenders=positive(v);}
    public long getGlobalDailySeconds(){return globalDailySeconds;}
    public void setGlobalDailySeconds(long v){globalDailySeconds=positive(v);}
    public long getGlobalActiveRenders(){return globalActiveRenders;}
    public void setGlobalActiveRenders(long v){globalActiveRenders=positive(v);}
    public long getWarnDailyRenders(){return warnDailyRenders;}
    public void setWarnDailyRenders(long v){warnDailyRenders=positive(v);}
    public long getWarnDailySeconds(){return warnDailySeconds;}
    public void setWarnDailySeconds(long v){warnDailySeconds=positive(v);}
    public long getWarnStorageBytes(){return warnStorageBytes;}
    public void setWarnStorageBytes(long v){warnStorageBytes=positive(v);}
    public long getWarnGlobalDailyRenders(){return warnGlobalDailyRenders;}
    public void setWarnGlobalDailyRenders(long v){warnGlobalDailyRenders=positive(v);}
    public long getWarnGlobalDailySeconds(){return warnGlobalDailySeconds;}
    public void setWarnGlobalDailySeconds(long v){warnGlobalDailySeconds=positive(v);}
    @PostConstruct
    public void validate(){
        if(enforce&&accountDailyRenders==0&&accountDailySeconds==0&&globalDailyRenders==0&&globalDailySeconds==0&&globalActiveRenders==0)
            throw new IllegalStateException("COST_ENFORCE=true requires at least one positive video limit; fill COST_ACCOUNT_DAILY_RENDERS, COST_ACCOUNT_DAILY_SECONDS or a COST_GLOBAL_* limit");
    }
    private static long positive(long v){if(v<0)throw new IllegalArgumentException("Cost thresholds cannot be negative");return v;}
}
