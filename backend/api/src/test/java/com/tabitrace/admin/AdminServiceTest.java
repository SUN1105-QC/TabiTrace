package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.LocalDateTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {
    @Mock AdminMapper mapper;
    @Mock UserMapper users;
    @Mock TripMapper trips;
    @Mock RefreshTokenMapper sessions;
    AdminService service;
    final LocalDateTime version = LocalDateTime.of(2026,11,15,0,0,0,123456000);

    @BeforeEach void setup() { service = new AdminService(mapper,users,trips,sessions); }
    void authorize() {
        var admin = new UserEntity(); admin.id=1L; admin.role="ADMIN"; admin.status="ACTIVE";
        when(users.findById(1L)).thenReturn(admin);
        lenient().when(users.lockById(1L)).thenReturn(admin);
    }
    UserRow target() {
        var row = new UserRow(); row.id=2L; row.role="USER"; row.status="ACTIVE"; row.updatedAt=version;
        row.email="fixture@example.test"; row.nickname="测试旅人"; row.avatarUrl="/uploads/avatar.jpg";
        return row;
    }
    UpdateUserRequest input(LocalDateTime expected, int months, String status) {
        return new UpdateUserRequest("基础用户",20,months,true,true,"INHERIT",status,expected);
    }
    @Test void unauthorizedUserCannotReadOrWrite() {
        assertEquals("ADMIN_REQUIRED",assertThrows(BusinessException.class,()->service.users(1L,"","",1,25)).getCode());
        assertThrows(BusinessException.class,()->service.user(1L,2L));
        assertThrows(BusinessException.class,()->service.update(1L,2L,input(version,1,"ACTIVE")));
        verifyNoInteractions(mapper,trips,sessions);
    }
    @Test void searchAndStatusUseServerPagination() {
        authorize(); when(mapper.users("旅人","DISABLED",50,25)).thenReturn(List.of(target()));
        when(mapper.userCount("旅人","DISABLED")).thenReturn(61L);
        var page=service.users(1L," 旅人 ","DISABLED",3,25);
        assertEquals(61,page.total()); assertEquals(3,page.page()); assertEquals(25,page.pageSize());
        assertEquals("/uploads/avatar.jpg",page.items().getFirst().avatarUrl());
        assertEquals(version,page.items().getFirst().updatedAt());
    }
    @Test void invalidPagingAndStatusesAreRejected() {
        authorize(); assertThrows(BusinessException.class,()->service.users(1L,"","ROOT",1,25));
        assertThrows(BusinessException.class,()->service.users(1L,"","",0,25));
        assertThrows(BusinessException.class,()->service.users(1L,"","",1,11)); verifyNoInteractions(mapper);
    }
    @Test void missingDetailDoesNotReturnAnotherAccount() {
        authorize(); assertEquals("USER_NOT_FOUND",assertThrows(BusinessException.class,()->service.user(1L,999L)).getCode());
    }
    @Test void staleVersionHasNoWriteOrCleanupSideEffects() {
        authorize(); when(users.lockById(2L)).thenReturn(target());
        assertEquals("ADMIN_USER_CHANGED",assertThrows(BusinessException.class,()->service.update(1L,2L,input(version.minusNanos(1000),1,"ACTIVE"))).getCode());
        verifyNoInteractions(mapper,trips,sessions);
    }
    @Test void administratorAndDeletionPendingAccountsStayProtected() {
        authorize(); var row=target(); row.role="ADMIN"; when(users.lockById(2L)).thenReturn(row);
        assertEquals("ADMIN_PROTECTED",assertThrows(BusinessException.class,()->service.update(1L,2L,input(version,1,"DISABLED"))).getCode());
        row.role="USER"; row.status="DELETION_PENDING";
        assertEquals("ACCOUNT_DELETION_PENDING",assertThrows(BusinessException.class,()->service.update(1L,2L,input(version,1,"ACTIVE"))).getCode());
        verifyNoInteractions(mapper,trips,sessions);
    }
    @Test void changedRetentionRecalculatesOnlyThroughExistingTripPolicy() {
        authorize(); var row=target(); when(users.lockById(2L)).thenReturn(row); when(mapper.user(2L)).thenReturn(row);
        service.update(1L,2L,input(version,12,"ACTIVE"));
        verify(trips).updateRetention(2L,12); verifyNoMoreInteractions(trips); verifyNoInteractions(sessions);
        verify(mapper).audit(eq(1L),eq(2L),eq("UPDATE_USER"),contains("before="));
        verify(mapper).audit(eq(1L),eq(2L),eq("UPDATE_USER"),contains("requestId="));
        verify(mapper).audit(eq(1L),eq(2L),eq("UPDATE_USER"),contains("result=SUCCESS"));
    }
    @Test void disablingRevokesSessionsWithoutDeletingJourneys() {
        authorize(); var row=target(); when(users.lockById(2L)).thenReturn(row); when(mapper.user(2L)).thenReturn(row);
        service.update(1L,2L,input(version,1,"DISABLED"));
        verify(sessions).revokeAll(2L); verifyNoInteractions(trips);
    }
    @Test void writeRateLimitIsEnforcedBeforeMutation() {
        authorize(); when(users.lockById(2L)).thenReturn(target()); when(mapper.recentPermissionUpdates(1L)).thenReturn(60);
        assertEquals("ADMIN_UPDATE_LIMIT",assertThrows(BusinessException.class,()->service.update(1L,2L,input(version,1,"ACTIVE"))).getCode());
        verify(mapper,never()).updateUser(anyLong(),any()); verifyNoInteractions(trips,sessions);
    }
    @Test void invalidPermissionInputCannotReachSqlMutation() {
        authorize(); when(users.lockById(2L)).thenReturn(target());
        var invalid=new UpdateUserRequest("基础用户",0,1,true,true,"ROOT","ACTIVE",version);
        assertEquals("INVALID_USER_PERMISSIONS",assertThrows(BusinessException.class,()->service.update(1L,2L,invalid)).getCode());
        verify(mapper,never()).updateUser(anyLong(),any()); verifyNoInteractions(trips,sessions);
    }
}
