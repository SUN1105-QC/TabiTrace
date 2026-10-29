package com.tabitrace.cost;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import static org.assertj.core.api.Assertions.assertThat;

class CostConfigurationTest {
    @Configuration @EnableConfigurationProperties(CostProperties.class) static class Config{}
    ApplicationContextRunner context=new ApplicationContextRunner().withUserConfiguration(Config.class);
    @Test void approvedDefaultsEnableTwentyRequestsSixThousandSecondsAndThreeGlobalTasks(){
        context.run(c->{
            assertThat(c).hasNotFailed();CostProperties p=c.getBean(CostProperties.class);
            assertThat(p.isEnforce()).isTrue();assertThat(p.getAccountDailyRenders()).isEqualTo(20);
            assertThat(p.getAccountDailySeconds()).isEqualTo(6000);assertThat(p.getGlobalActiveRenders()).isEqualTo(3);
        });
    }
    @Test void enabledSwitchWithAllZeroLimitsCannotPretendToEnforce(){
        context.withPropertyValues("app.cost.enforce=true","app.cost.account-daily-renders=0","app.cost.account-daily-seconds=0","app.cost.global-active-renders=0").run(c->{
            assertThat(c).hasFailed();assertThat(c.getStartupFailure()).hasStackTraceContaining("COST_ENFORCE=true requires at least one positive");
        });
    }
    @Test void explicitlyProvidedPositiveLimitEnablesEnforcement(){
        context.withPropertyValues("app.cost.enforce=true","app.cost.account-daily-renders=12").run(c->{
            assertThat(c).hasNotFailed();assertThat(c.getBean(CostProperties.class).getAccountDailyRenders()).isEqualTo(12);
            assertThat(c.getBean(CostProperties.class).isEnforce()).isTrue();
        });
    }
    @Test void negativeLimitsCannotDisableProtectionSilently(){
        context.withPropertyValues("app.cost.account-daily-renders=-1").run(c->assertThat(c).hasFailed());
    }
    @Test void explicitObservationModeStillAcceptsUnlimitedBudgets(){
        context.withPropertyValues("app.cost.enforce=false","app.cost.account-daily-renders=0","app.cost.account-daily-seconds=0","app.cost.global-active-renders=0")
                .run(c->{assertThat(c).hasNotFailed();assertThat(c.getBean(CostProperties.class).isEnforce()).isFalse();});
    }
}
