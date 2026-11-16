package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @Validated
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final AdminService service;private final SupportService support;
    public AdminController(AdminService service,SupportService support){this.service=service;this.support=support;}
    @GetMapping("/overview") public ApiResponse<Overview> overview(){return ApiResponse.ok(service.overview(SecurityUtils.currentUser().id()));}
    @GetMapping("/users") public ApiResponse<UserPage> users(
            @RequestParam(defaultValue="") @Size(max=200) String q,
            @RequestParam(defaultValue="") @Pattern(regexp="|ACTIVE|DISABLED|DELETION_PENDING") String status,
            @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="25") @Min(10) @Max(50) int pageSize){
        return ApiResponse.ok(service.users(SecurityUtils.currentUser().id(),q,status,page,pageSize));
    }
    @GetMapping("/users/{id}") public ApiResponse<UserView> user(@PathVariable @Min(1) Long id){return ApiResponse.ok(service.user(SecurityUtils.currentUser().id(),id));}
    @PutMapping("/users/{id}") public ApiResponse<UserView> update(@PathVariable @Min(1) Long id,@Valid @RequestBody UpdateUserRequest r){return ApiResponse.ok(service.update(SecurityUtils.currentUser().id(),id,r));}
    @GetMapping("/messages") public ApiResponse<List<MessageView>> messages(@RequestParam(defaultValue="") @Pattern(regexp="|OPEN|REPLIED") String status,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(support.inbox(SecurityUtils.currentUser().id(),status,page));}
    @GetMapping("/messages/page") public ApiResponse<MessagePage> messagePage(@RequestParam(defaultValue="") @Pattern(regexp="|OPEN|REPLIED") String status,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(support.inboxPage(SecurityUtils.currentUser().id(),status,page));}
    @PostMapping("/messages/{id}/reply") public ApiResponse<MessageView> reply(@PathVariable Long id,@Valid @RequestBody ReplyRequest r){return ApiResponse.ok(support.reply(SecurityUtils.currentUser().id(),id,r));}
}
