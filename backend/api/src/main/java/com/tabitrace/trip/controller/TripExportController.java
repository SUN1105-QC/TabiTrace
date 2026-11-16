package com.tabitrace.trip.controller;

import com.tabitrace.security.SecurityUtils;
import com.tabitrace.trip.service.TripExportService;
import com.tabitrace.trip.service.TripService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController @RequestMapping("/api/v1/trips")
public class TripExportController {
    private final TripService trips;private final TripExportService export;
    public TripExportController(TripService trips,TripExportService export){this.trips=trips;this.export=export;}
    @GetMapping("/{id}/export") public ResponseEntity<StreamingResponseBody> download(@PathVariable Long id){
        Long userId=SecurityUtils.currentUser().id();trips.requireOwned(userId,id);
        return ResponseEntity.ok().header("Content-Disposition","attachment; filename=\"tabitrace-trip-"+id+".zip\"")
                .header("Cache-Control","no-store").header("Content-Type","application/zip")
                .body(output->export.write(userId,id,output));
    }
}
