package com.tabitrace.cost;

import com.tabitrace.common.BusinessException;
import org.junit.jupiter.api.*;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CostControlServiceTest {
    CostMapper mapper=mock(CostMapper.class);
    CostProperties props=new CostProperties();
    Clock clock=Clock.fixed(Instant.parse("2026-10-28T23:59:50Z"),ZoneOffset.UTC);
    CostControlService service=new CostControlService(mapper,props,clock);
    CostMapper.Daily account=new CostMapper.Daily(),global=new CostMapper.Daily();
    @BeforeEach void setup(){when(mapper.lockDaily(eq("global"),any())).thenReturn(global);when(mapper.lockDaily(eq("user:1"),any())).thenReturn(account);}
    @Test void observationModeDoesNotEnforceConfiguredLimits(){
        props.setEnforce(false);
        props.setAccountDailyRenders(1);account.renderCount=50;
        service.reserveRender(1L,30);verify(mapper).increment("user:1",LocalDate.of(2026,10,28),30);
    }
    @Test void enforcedDurationBudgetRejectsBeforeChangingCounters(){
        props.setEnforce(true);props.setAccountDailySeconds(30);account.outputSeconds=20;
        BusinessException e=assertThrows(BusinessException.class,()->service.reserveRender(1L,15));
        assertEquals("VIDEO_DAILY_BUDGET",e.getCode());assertEquals(10L,e.getDetails().get("retryAfter"));
        verify(mapper,never()).increment(any(),any(),anyInt());
    }
    @Test void exactBoundaryIsAllowedAndZeroMeansUnlimited(){
        props.setEnforce(true);props.setAccountDailySeconds(30);service.reserveRender(1L,30);
        verify(mapper).increment("global",LocalDate.of(2026,10,28),30);
    }
    @Test void globalBudgetCanRejectAnAccountBelowItsOwnBudget(){
        props.setEnforce(true);props.setGlobalDailyRenders(5);global.renderCount=5;
        assertThrows(BusinessException.class,()->service.reserveRender(1L,30));verify(mapper,never()).increment(any(),any(),anyInt());
    }
    @Test void globalQueueLimitIsOptionalButLockIsAlwaysRequired(){
        props.setEnforce(false);
        when(mapper.lockGlobal()).thenReturn("video-render");when(mapper.lockUser(1L)).thenReturn(1L);
        props.setGlobalActiveRenders(1);when(mapper.activeGlobal()).thenReturn(10L);
        service.lockRendering(1L);
        props.setEnforce(true);assertEquals("VIDEO_GLOBAL_QUEUE_LIMIT",assertThrows(BusinessException.class,()->service.lockRendering(1L)).getCode());
    }
    @Test void usageUsesUtcDayAndReportsUnmeasuredFilesInsteadOfCallingThemZero(){
        CostMapper.Storage s=new CostMapper.Storage();s.photoBytes=100;s.unknownVideos=2;when(mapper.storage(1L)).thenReturn(s);
        CostControlService zoned=new CostControlService(mapper,props,clock.withZone(ZoneId.of("Asia/Tokyo")));
        var usage=zoned.usage(1L);assertEquals(LocalDate.of(2026,10,28),usage.day());assertEquals(0,usage.renderRequests());assertEquals(2,usage.media().unknownVideos());
    }
    @Test void negativeLimitsFailAtConfigurationTime(){assertThrows(IllegalArgumentException.class,()->props.setAccountDailyRenders(-1));}
}
