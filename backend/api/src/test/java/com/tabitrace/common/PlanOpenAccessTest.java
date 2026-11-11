package com.tabitrace.common;

import com.tabitrace.membership.mapper.MembershipMapper;
import com.tabitrace.membership.service.MembershipService;
import com.tabitrace.payment.mapper.PaymentMapper;
import com.tabitrace.payment.service.PaymentService;
import com.tabitrace.payment.service.PaymentTransactions;
import com.tabitrace.payment.service.PlanService;
import com.tabitrace.payment.service.StripeGateway;
import com.tabitrace.place.mapper.PlaceMapper;
import com.tabitrace.place.mapper.TripPlaceMapper;
import com.tabitrace.trip.dto.TripDtos.CreateTripRequest;
import com.tabitrace.trip.entity.TripEntity;
import com.tabitrace.trip.mapper.TripMapper;
import com.tabitrace.trip.service.OpenAccessTripUpgrade;
import com.tabitrace.trip.service.TripService;
import com.tabitrace.video.mapper.VideoCatalogMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 全部功能免费开放：开关打开后各付费门槛统一放行，关闭时保持原规则（关闭时的规则由各服务原有单测覆盖） */
class PlanOpenAccessTest {
    static final PlanAccess OPEN = new PlanAccess(true);

    static <T> T open(T service) { ReflectionTestUtils.setField(service, "planAccess", OPEN); return service; }

    static TripService trips(TripMapper tm) {
        return new TripService(tm, mock(PlaceMapper.class), mock(TripPlaceMapper.class), mock(com.tabitrace.city.mapper.OfficialCityMapper.class));
    }

    static CreateTripRequest request() {
        return new CreateTripRequest("第二段旅行", "京都", null, null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 3), 1, null, false);
    }

    @Test void defaultIsClosed() {
        assertFalse(PlanAccess.CLOSED.open());
        assertTrue(OPEN.open());
    }

    @Test void newTripsArePro_andFreeTripLimitDoesNotApply() {
        TripMapper tm = mock(TripMapper.class);
        when(tm.countFreeTrips(1L)).thenReturn(5);
        doAnswer(i -> { ((TripEntity) i.getArgument(0)).id = 11L; return 1; }).when(tm).insert(any());
        var r = open(trips(tm)).create(1L, request());
        assertEquals("PRO", r.planType());
        verify(tm, never()).hasLifetimePro(any());
    }

    @Test void unarchivingAFreeTripIgnoresFreeLimit() {
        TripMapper tm = mock(TripMapper.class);
        TripEntity t = new TripEntity(); t.id = 10L; t.userId = 1L; t.planType = "FREE"; t.status = "ARCHIVED";
        when(tm.findById(10L)).thenReturn(t);
        when(tm.countFreeTrips(1L)).thenReturn(3);
        open(trips(tm)).unarchive(1L, 10L);
        verify(tm).updateStatus(10L, "COMPLETED");
    }

    @Test void startupUpgradesExistingFreeTripsOnlyWhenOpen() throws Exception {
        TripMapper tm = mock(TripMapper.class);
        new OpenAccessTripUpgrade(PlanAccess.CLOSED, tm).run(null);
        verify(tm, never()).upgradeAllFreeToPro();
        new OpenAccessTripUpgrade(OPEN, tm).run(null);
        verify(tm).upgradeAllFreeToPro();
    }

    @Test void everyAccountHasMemberFeatures_withoutWritingMembership() {
        MembershipMapper mm = mock(MembershipMapper.class);
        when(mm.listByUser(1L)).thenReturn(List.of());
        MembershipService s = open(new MembershipService(mm));
        var m = s.current(1L);
        assertTrue(m.active());
        assertEquals(MembershipService.SOURCE_OPEN_ACCESS, m.source());
        assertEquals(List.of(MembershipService.FEATURE_CUSTOM_MUSIC), m.features());
        assertDoesNotThrow(() -> s.require(1L, MembershipService.FEATURE_CUSTOM_MUSIC));
        verify(mm, never()).insert(any());
    }

    @Test void checkoutIsRefused_andNoOrderIsWritten() {
        PaymentMapper pm = mock(PaymentMapper.class);
        PaymentService p = open(new PaymentService(pm, mock(PaymentTransactions.class), mock(StripeGateway.class), "mock", "https://tabi.example", 400));
        for (var call : List.<org.junit.jupiter.api.function.Executable>of(() -> p.checkout(1L, 5L), () -> p.checkoutLifetime(1L))) {
            BusinessException e = assertThrows(BusinessException.class, call);
            assertEquals("PLANS_OPEN_ACCESS", e.getCode());
            assertEquals(HttpStatus.CONFLICT, e.getStatus());
        }
        verify(pm, never()).insert(any());
        assertTrue(p.openAccess());
    }

    @Test void planConfigAnnouncesOpenAccess() {
        VideoCatalogMapper catalog = mock(VideoCatalogMapper.class);
        when(catalog.templates()).thenReturn(List.of());
        PaymentService payments = mock(PaymentService.class);
        when(payments.openAccess()).thenReturn(true);
        assertTrue(new PlanService(catalog, payments).tripPro().openAccess());
        when(payments.openAccess()).thenReturn(false);
        assertFalse(new PlanService(catalog, payments).tripPro().openAccess());
    }
}
