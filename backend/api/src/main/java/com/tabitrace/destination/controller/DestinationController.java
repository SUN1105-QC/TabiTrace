package com.tabitrace.destination.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.destination.dto.DestinationDtos.DestinationView;
import com.tabitrace.destination.service.DestinationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class DestinationController {
    private final DestinationService service;
    public DestinationController(DestinationService service) { this.service = service; }

    @GetMapping("/destinations/search")
    public ApiResponse<List<DestinationView>> search(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "8") int limit) {
        return ApiResponse.ok(service.search(q, limit));
    }
}
