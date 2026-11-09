package com.tabitrace.summary;

import com.tabitrace.checkin.mapper.CheckinMapper;
import com.tabitrace.photo.mapper.PhotoMapper;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.summary.service.SummaryService;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.user.mapper.UserMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class CityExplorationProgressTest {
    TripService trips=mock(TripService.class);
    CheckinMapper checkins=mock(CheckinMapper.class);
    PhotoMapper photos=mock(PhotoMapper.class);
    PlaceMapper places=mock(PlaceMapper.class);
    UserMapper users=mock(UserMapper.class);
    SummaryService service=new SummaryService(trips,checkins,photos,places,users);
    TripEntity setup() {
        var t=new TripEntity();t.id=9L;t.userId=1L;t.title="旅行";t.startDate=LocalDate.of(2026,11,1);t.endDate=t.startDate.plusDays(2);
        when(trips.requireOwned(1L,9L)).thenReturn(t);when(checkins.listByTrip(9L)).thenReturn(List.of());when(photos.listByTrip(9L)).thenReturn(List.of());return t;
    }
    @ParameterizedTest @ValueSource(strings={"东京","首尔","香港","台北"})
    void explorationUsesTheCurrentOfficialCityOnly(String city) {
        var t=setup();when(trips.officialCityName(t)).thenReturn(city);
        when(places.countOfficialByCity(city)).thenReturn(30);when(checkins.countOfficialByCity(9L,city)).thenReturn(12);
        var summary=service.get(1L,9L);assertEquals(30,summary.officialPlacesTotal());assertEquals(12,summary.officialPlacesCompleted());assertEquals(40,summary.explorationRate());
        verify(checkins,never()).countOfficial(anyLong());
    }
    @Test void nonOfficialDestinationsDoNotAcquireAnotherCitysProgress() {
        setup();var s=service.get(1L,9L);assertEquals(0,s.officialPlacesTotal());assertEquals(0,s.officialPlacesCompleted());assertEquals(0,s.explorationRate());verifyNoInteractions(places);
    }
}
