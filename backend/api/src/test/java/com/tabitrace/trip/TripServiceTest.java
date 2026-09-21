package com.tabitrace.trip;

import com.tabitrace.achievement.service.AchievementService;
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
    @Test void createsFreeTrip(){TripMapper tm=mock(TripMapper.class);PlaceMapper pm=mock(PlaceMapper.class);TripPlaceMapper tpm=mock(TripPlaceMapper.class);AchievementService am=mock(AchievementService.class);when(tm.countFreeTrips(1L)).thenReturn(0);doAnswer(i->{var t=(com.tabitrace.trip.entity.TripEntity)i.getArgument(0);t.id=10L;return 1;}).when(tm).insert(any());TripService s=new TripService(tm,pm,tpm,am);var result=s.create(1L,new CreateTripRequest("东京旅行","东京","JP","东京",LocalDate.of(2026,10,1),LocalDate.of(2026,10,6),2,null,false));assertEquals(10L,result.id());assertEquals("FREE",result.planType());assertEquals("PRIVATE",result.visibility());}
    @Test void archivedTripIsReadOnly(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ARCHIVED"));TripService s=service(tm);var ex=assertThrows(BusinessException.class,()->s.requireWritable(1L,10L));assertEquals("TRIP_ARCHIVED",ex.getCode());assertThrows(BusinessException.class,()->s.complete(1L,10L));verify(tm,never()).complete(any());}
    @Test void archiveMarksTripArchived(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ONGOING"));service(tm).archive(1L,10L);verify(tm).updateStatus(10L,"ARCHIVED");}
    @Test void unarchiveFreeTripRespectsFreeLimit(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("FREE","ARCHIVED"));when(tm.countFreeTrips(1L)).thenReturn(1);var ex=assertThrows(BusinessException.class,()->service(tm).unarchive(1L,10L));assertEquals("FREE_TRIP_LIMIT",ex.getCode());verify(tm,never()).updateStatus(any(),any());}
    @Test void unarchiveRestoresCompletedStatus(){TripMapper tm=mock(TripMapper.class);when(tm.findById(10L)).thenReturn(trip("PRO","ARCHIVED"));when(tm.countFreeTrips(1L)).thenReturn(1);service(tm).unarchive(1L,10L);verify(tm).updateStatus(10L,"COMPLETED");}
    private static TripService service(TripMapper tm){return new TripService(tm,mock(PlaceMapper.class),mock(TripPlaceMapper.class),mock(AchievementService.class));}
    private static TripEntity trip(String planType,String status){TripEntity t=new TripEntity();t.id=10L;t.userId=1L;t.title="东京旅行";t.destinationName="东京";t.startDate=LocalDate.of(2026,10,1);t.endDate=LocalDate.of(2026,10,6);t.planType=planType;t.status=status;t.visibility="PRIVATE";return t;}
}
