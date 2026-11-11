package com.tabitrace.trip.service;

import com.tabitrace.common.PlanAccess;
import com.tabitrace.trip.mapper.TripMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 全部功能免费开放时，启动后把已有 FREE 旅行一次性升级为 PRO（新旅行由 TripService.create 直接建成 PRO）。
 * 只升级不降级：之后关闭开关，这些旅行仍保留 PRO，避免已经超出 Free 限制的记录变得不可用。
 */
@Component
public class OpenAccessTripUpgrade implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(OpenAccessTripUpgrade.class);
    private final PlanAccess access;
    private final TripMapper trips;

    public OpenAccessTripUpgrade(PlanAccess access, TripMapper trips) { this.access = access; this.trips = trips; }

    @Override
    public void run(ApplicationArguments args) {
        if (!access.open()) return;
        int upgraded = trips.upgradeAllFreeToPro();
        log.info("Plans open access enabled: upgraded {} FREE trips to PRO", upgraded);
    }
}
