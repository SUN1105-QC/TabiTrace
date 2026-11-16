package com.tabitrace.trip;

import com.tabitrace.common.BusinessException;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.dto.TripDtos.CreateTripRequest;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TripServiceTest {
    @Test void createsFreeTrip(){TripMapper tm=mock(TripMapper.class);PlaceMapper pm=mock(PlaceMapper.class);TripPlaceMapper tpm=mock(TripPlaceMapper.class);when(tm.countFreeTrips(1L)).thenReturn(0);doAnswer(i->{var t=(com.tabitrace.trip.entity.TripEntity)i.getArgument(0);t.id=10L;return 1;}).when(tm).insert(any());TripService s=new TripService(tm,pm,tpm,mock(com.tabitrace.city.mapper.OfficialCityMapper.class));var result=s.create(1L,new CreateTripRequest("东京旅行","东京","JP","东京",LocalDate.of(2026,10,1),LocalDate.of(2026,10,6),2,null,false));assertEquals(10L,result.id());assertEquals("FREE",result.planType());assertEquals("PRIVATE",result.visibility());}
    @Test void archivedTripIsReadOnly(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ARCHIVED"));TripService s=service(tm);var ex=assertThrows(BusinessException.class,()->s.requireWritable(1L,10L));assertEquals("TRIP_ARCHIVED",ex.getCode());assertThrows(BusinessException.class,()->s.complete(1L,10L));verify(tm,never()).complete(any());}
    @Test void archiveMarksTripArchived(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ONGOING"));service(tm).archive(1L,10L);verify(tm).updateStatus(10L,"ARCHIVED");}
    @Test void unarchiveUsesExistingQuotaSlot(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ARCHIVED"));when(tm.countLiveTrips(1L)).thenReturn(20);service(tm).unarchive(1L,10L);verify(tm).updateStatus(10L,"COMPLETED");}
    @Test void unarchiveRestoresCompletedStatus(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("PRO","ARCHIVED"));when(tm.countFreeTrips(1L)).thenReturn(1);service(tm).unarchive(1L,10L);verify(tm).updateStatus(10L,"COMPLETED");}
    /** 已买断终身 Pro：新建旅行直接是 PRO，已经有 Free 旅行也不受数量限制 */
    @Test void lifetimeProCreatesProTripWithoutFreeLimit(){TripMapper tm=mock(TripMapper.class);when(tm.hasLifetimePro(1L)).thenReturn(1);when(tm.countFreeTrips(1L)).thenReturn(1);doAnswer(i->{var t=(TripEntity)i.getArgument(0);t.id=11L;return 1;}).when(tm).insert(any());var r=service(tm).create(1L,new CreateTripRequest("第二段旅行","京都",null,null,LocalDate.of(2026,11,1),LocalDate.of(2026,11,3),1,null,false));assertEquals("PRO",r.planType());}
    @Test void twentiethTripIsTheBasicAccountLimit(){TripMapper tm=mock(TripMapper.class);when(tm.countLiveTrips(1L)).thenReturn(20);var ex=assertThrows(BusinessException.class,()->service(tm).create(1L,new CreateTripRequest("第二十一段旅行","京都",null,null,LocalDate.of(2026,11,1),LocalDate.of(2026,11,3),1,null,false)));assertEquals("TRIP_LIMIT_REACHED",ex.getCode());verify(tm,never()).insert(any());}
    @Test void lifetimeProStillRespectsAccountQuota(){TripMapper tm=mock(TripMapper.class);when(tm.hasLifetimePro(1L)).thenReturn(1);when(tm.countLiveTrips(1L)).thenReturn(20);assertThrows(BusinessException.class,()->service(tm).create(1L,new CreateTripRequest("满额","京都",null,null,LocalDate.now(),LocalDate.now(),1,null,false)));}
    @Test void expiryIsOneCalendarMonthFromCreation(){TripMapper tm=mock(TripMapper.class);var r=service(tm).create(1L,new CreateTripRequest("旅程","东京",null,null,LocalDate.now(),LocalDate.now(),1,null,false));assertEquals(r.createdAt().plusMonths(1),r.expiresAt());}
    @Test void expiredTripCannotBeReadOrEdited(){TripMapper tm=mock(TripMapper.class);var t=trip("PRO","COMPLETED");t.expiresAt=java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).minusSeconds(1);when(tm.findById(10L)).thenReturn(t);assertEquals("TRIP_EXPIRED",assertThrows(BusinessException.class,()->service(tm).requireOwned(1L,10L)).getCode());}
    private static TripService service(TripMapper tm){return new TripService(tm,mock(PlaceMapper.class),mock(TripPlaceMapper.class),mock(com.tabitrace.city.mapper.OfficialCityMapper.class));}
    private static TripEntity trip(String planType,String status){TripEntity t=new TripEntity();t.id=10L;t.userId=1L;t.title="东京旅行";t.destinationName="东京";t.startDate=LocalDate.of(2026,10,1);t.endDate=LocalDate.of(2026,10,6);t.planType=planType;t.status=status;t.visibility="PRIVATE";return t;}
}
