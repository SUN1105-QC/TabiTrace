package com.tabitrace.admin;

import com.tabitrace.admin.AdminModuleDtos.*;
import com.tabitrace.trip.service.TripExpiryService;
import com.tabitrace.user.service.AccountDeletionService;
import com.tabitrace.usermusic.service.UserMusicService;
import org.junit.jupiter.api.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AdminMaintenanceRunnerTest {
    final AdminModuleMapper mapper=mock(AdminModuleMapper.class);
    final AdminMapper audit=mock(AdminMapper.class);
    final TripExpiryService trips=mock(TripExpiryService.class);
    final AccountDeletionService accounts=mock(AccountDeletionService.class);
    final UserMusicService music=mock(UserMusicService.class);
    final AdminMaintenanceRunner runner=new AdminMaintenanceRunner(mapper,audit,trips,accounts,music);
    @AfterEach void stop(){runner.shutdown();}
    Job job(String kind){var j=new Job();j.id=7L;j.requestedBy=1L;j.kind=kind;j.status="QUEUED";return j;}
    void prepare(String kind){runner.recover();when(mapper.queuedJob()).thenReturn(job(kind)).thenReturn(null);when(mapper.claimJob(7L)).thenReturn(1);when(mapper.maintenance()).thenReturn(new Maintenance(0,0,0,0));}
    @Test void cleanupRunsOffRequestThreadAndPersistsItsResult(){
        prepare("TRIPS");when(trips.purgeDue()).thenReturn(2);runner.dispatch();
        verify(mapper,timeout(3000)).finishJob(eq(7L),eq("COMPLETED"),contains("已清理 2 项"));
        verify(trips).purgeDue();verifyNoInteractions(accounts,music);verify(mapper).recoverJobs();
    }
    @Test void failedCleanupDoesNotReportSuccessOrLeakExceptionDetails(){
        prepare("ACCOUNTS");when(accounts.purgeDue()).thenThrow(new RuntimeException("secret-storage-key"));runner.dispatch();
        verify(mapper,timeout(3000)).finishJob(eq(7L),eq("FAILED"),eq("本轮维护未完成，请检查服务日志后重试。"));
    }
    @Test void failedResultWriteIsRetriedWithoutRunningCleanupAgain()throws Exception{
        prepare("MUSIC");when(mapper.finishJob(eq(7L),anyString(),anyString())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline")).thenReturn(1);
        runner.dispatch();verify(mapper,timeout(3000)).finishJob(eq(7L),eq("COMPLETED"),contains("尝试清理"));
        // 等待执行线程释放 busy；后续调度只补写结果，不重复清理资源。
        for(int i=0;i<30;i++){runner.dispatch();if(mockingDetails(mapper).getInvocations().stream().filter(x->x.getMethod().getName().equals("finishJob")).count()>=2)break;Thread.sleep(20);}
        verify(mapper,times(2)).finishJob(eq(7L),eq("COMPLETED"),anyString());verify(music,times(1)).cleanup();
    }
    @Test void unclaimedJobNeverRunsCleanup(){prepare("TRIPS");when(mapper.claimJob(7L)).thenReturn(0);runner.dispatch();verifyNoInteractions(trips,accounts,music);}
}
