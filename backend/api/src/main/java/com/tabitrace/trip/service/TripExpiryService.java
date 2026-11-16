package com.tabitrace.trip.service;

import com.tabitrace.trip.mapper.TripMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class TripExpiryService {
    private static final Logger log = LoggerFactory.getLogger(TripExpiryService.class);
    private final TripMapper trips;
    private final TripDeletionService deletion;

    public TripExpiryService(TripMapper trips, TripDeletionService deletion) {
        this.trips = trips;
        this.deletion = deletion;
    }

    @Scheduled(fixedDelayString = "${app.trip-expiry.interval-ms:60000}",
            initialDelayString = "${app.trip-expiry.initial-delay-ms:60000}")
    public int purgeDue() {
        int done = 0;
        for (var t : trips.expired(200)) {
            try {
                if (deletion.deleteExpired(t.userId, t.id)) {
                    done++;
                    log.info("TRIP: expired journey deleted tripId={} userId={}", t.id, t.userId);
                }
            } catch (RuntimeException e) {
                log.warn("TRIP: expiration cleanup will retry tripId={} reason={}", t.id, e.getMessage());
            }
        }
        return done;
    }
}
