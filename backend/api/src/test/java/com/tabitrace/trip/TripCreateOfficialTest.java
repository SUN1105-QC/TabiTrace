package com.tabitrace.trip;

import com.tabitrace.achievement.service.AchievementService;
import com.tabitrace.city.entity.OfficialCityEntity;
import com.tabitrace.city.mapper.OfficialCityMapper;
import com.tabitrace.common.BusinessException;
import com.tabitrace.place.entity.PlaceEntity;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.dto.TripDtos.CreateTripRequest;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.TripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 创建旅行时的官方探索：按官方城市表匹配，而不是写死东京 */
class TripCreateOfficialTest {
    TripMapper trips; PlaceMapper places; TripPlaceMapper tripPlaces; OfficialCityMapper cities; TripService service;

    @BeforeEach
    void setUp() {
        trips = mock(TripMapper.class); places = mock(PlaceMapper.class); tripPlaces = mock(TripPlaceMapper.class); cities = mock(OfficialCityMapper.class);
        service = new TripService(trips, places, tripPlaces, mock(AchievementService.class), cities);
        doAnswer(i -> { ((TripEntity) i.getArgument(0)).id = 42L; return 1; }).when(trips).insert(any());
    }

    static OfficialCityEntity city(String code, String name) { OfficialCityEntity c = new OfficialCityEntity(); c.code = code; c.name = name; return c; }
    static PlaceEntity place(long id) { PlaceEntity p = new PlaceEntity(); p.id = id; return p; }
    static CreateTripRequest req(String city, boolean join) { return new CreateTripRequest("  周末旅行 ", " " + city + " ", null, city, LocalDate.of(2026, 12, 30), LocalDate.of(2027, 1, 2), 2, null, join); }

    @Test
    void officialCityPlacesAreAddedWhenJoining() {
        when(cities.findActiveByCity("京都")).thenReturn(city("KYOTO", "京都"));
        when(places.findOfficialByCity("京都")).thenReturn(List.of(place(7), place(9)));
        var view = service.create(1L, req("京都", true));
        assertEquals("周末旅行", view.title());
        assertEquals("京都", view.destinationName());
        verify(tripPlaces).add(42L, 7L, 1);
        verify(tripPlaces).add(42L, 9L, 2);
    }

    @Test
    void cityWithoutOfficialContentAddsNothing() {
        service.create(1L, req("大阪", true));
        verifyNoInteractions(tripPlaces);
    }

    @Test
    void notJoiningDoesNotLookUpOfficialCity() {
        service.create(1L, req("京都", false));
        verifyNoInteractions(cities, tripPlaces);
    }

    @Test
    void endBeforeStartIsRejected() {
        var bad = new CreateTripRequest("旅行", "京都", null, "京都", LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 1), 1, null, false);
        assertThrows(BusinessException.class, () -> service.create(1L, bad));
        verify(trips, never()).insert(any());
    }
}
