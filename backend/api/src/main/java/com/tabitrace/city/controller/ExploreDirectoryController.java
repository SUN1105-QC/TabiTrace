package com.tabitrace.city.controller;

import com.tabitrace.city.service.ExploreDirectoryService;
import com.tabitrace.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ExploreDirectoryController {
    private final ExploreDirectoryService service;
    public ExploreDirectoryController(ExploreDirectoryService service){this.service=service;}
    @GetMapping("/api/v1/official-cities/directory")
    public ApiResponse<ExploreDirectoryService.Directory> directory(){return ApiResponse.ok(service.load());}
}
