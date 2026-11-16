package com.tabitrace.admin;

import com.tabitrace.admin.AdminModuleDtos.*;
import com.tabitrace.common.ApiResponse;
import com.tabitrace.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.core.env.Environment;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController @Validated
@RequestMapping("/api/v1/admin")
public class AdminModuleController {
    private final AdminModuleService service;
    private final AdminService admin;
    private final Environment environment;
    public AdminModuleController(AdminModuleService service,AdminService admin,Environment environment){this.service=service;this.admin=admin;this.environment=environment;}
    private Long actor(){return SecurityUtils.currentUser().id();}
    @GetMapping("/invitations") public ApiResponse<Page<Invitation>> invitations(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(service.invitations(actor(),page));}
    @PostMapping("/invitations") public ApiResponse<Invitation> invite(@Valid @RequestBody InvitationRequest r){return ApiResponse.ok(service.invite(actor(),r));}
    @PostMapping("/invitations/{id}/{action}") public ApiResponse<Invitation> invitationAction(@PathVariable @Min(1) Long id,@PathVariable @Pattern(regexp="RESEND|REVOKE") String action,@Valid @RequestBody VersionRequest r){return ApiResponse.ok(service.invitationAction(actor(),id,action,r));}
    @PostMapping("/users/{id}/deletion") public ApiResponse<AdminDtos.UserView> deleteUser(@PathVariable @Min(1) Long id,@Valid @RequestBody DeleteUserRequest r){return ApiResponse.ok(service.deleteUser(actor(),id,r));}
    @PostMapping("/users/{id}/cancel-deletion") public ApiResponse<AdminDtos.UserView> restoreUser(@PathVariable @Min(1) Long id,@Valid @RequestBody VersionRequest r){return ApiResponse.ok(service.restoreUser(actor(),id,r));}
    @GetMapping("/settings/defaults") public ApiResponse<Defaults> defaults(){return ApiResponse.ok(service.defaults(actor()));}
    @PutMapping("/settings/defaults") public ApiResponse<Defaults> saveDefaults(@Valid @RequestBody DefaultsRequest r){return ApiResponse.ok(service.defaults(actor(),r));}
    @GetMapping("/settings/runtime") public ApiResponse<Map<String,Object>> runtime(){
        admin.requireAdmin(actor());
        // 只读白名单，绝不返回任意环境变量、连接串、SMTP / R2 / JWT / 支付密钥。
        return ApiResponse.ok(Map.of("storageMode",environment.getProperty("app.storage.mode","local"),
                "mailProvider",environment.getProperty("app.mail.provider","smtp"),"javaVersion",Runtime.version().feature(),
                "costEnforce",environment.getProperty("app.cost.enforce",Boolean.class,true),
                "accountDailyRenders",environment.getProperty("app.cost.account-daily-renders",Integer.class,20),
                "accountDailySeconds",environment.getProperty("app.cost.account-daily-seconds",Integer.class,6000),
                "globalActiveRenders",environment.getProperty("app.cost.global-active-renders",Integer.class,3)));
    }
    @GetMapping("/trips") public ApiResponse<Page<Trip>> trips(@RequestParam(defaultValue="") @Size(max=200) String q,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(service.trips(actor(),q,status,page));}
    @PostMapping("/trips/{id}/action") public ApiResponse<Void> tripAction(@PathVariable @Min(1) Long id,@Valid @RequestBody TripAction r){service.tripAction(actor(),id,r);return ApiResponse.ok();}
    @GetMapping("/media") public ApiResponse<Page<Media>> media(@RequestParam(defaultValue="") String kind,@RequestParam(defaultValue="") @Size(max=200) String q,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(service.media(actor(),kind,q,status,page));}
    @PostMapping("/media/{kind}/{id}/deletion") public ApiResponse<Void> deleteMedia(@PathVariable String kind,@PathVariable @Min(1) Long id,@Valid @RequestBody MediaDelete r){service.deleteMedia(actor(),kind,id,r);return ApiResponse.ok();}
    @GetMapping("/audit-logs") public ApiResponse<Page<Audit>> audit(@RequestParam(defaultValue="") @Size(max=200) String q,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page){return ApiResponse.ok(service.audit(actor(),q,page));}
    @GetMapping("/maintenance") public ApiResponse<Maintenance> maintenance(){return ApiResponse.ok(service.maintenance(actor()));}
    @GetMapping("/maintenance/jobs") public ApiResponse<List<Job>> jobs(){return ApiResponse.ok(service.jobs(actor()));}
    @PostMapping("/maintenance/jobs") public ApiResponse<Job> enqueue(@Valid @RequestBody JobRequest r){return ApiResponse.ok(service.enqueue(actor(),r));}
}
