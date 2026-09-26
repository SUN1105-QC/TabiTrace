package com.tabitrace.memory.controller;

import com.tabitrace.common.ApiResponse;
import com.tabitrace.memory.dto.MemoryDtos.MemoriesView;
import com.tabitrace.memory.dto.MemoryDtos.TripPage;
import com.tabitrace.memory.service.MemoryService;
import com.tabitrace.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/memories")
public class MemoryController {
    private final MemoryService service;
    public MemoryController(MemoryService service) { this.service = service; }

    /** 旅行回忆中心首屏：概览、第一页归档旅行、往年今日、作品、时间轴、照片与成就 */
    @GetMapping public ApiResponse<MemoriesView> memories(@RequestParam(defaultValue = "6") int limit) {
        return ApiResponse.ok(service.memories(SecurityUtils.currentUser().id(), limit));
    }

    /** 归档旅行分页（查看更多） */
    @GetMapping("/trips") public ApiResponse<TripPage> trips(@RequestParam(defaultValue = "6") int offset, @RequestParam(defaultValue = "6") int limit) {
        return ApiResponse.ok(service.trips(SecurityUtils.currentUser().id(), offset, limit));
    }
}
