package com.tabitrace.admin;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

/** 管理接口仅返回所需的元数据，不向浏览器暴露密码哈希、对象存储密钥或分享令牌。 */
public final class AdminModuleDtos {
    private AdminModuleDtos() {}
    public record Page<T>(List<T> items,long total,int page,int pageSize) {}
    public record InvitationRequest(@Email @NotBlank @Size(max=255) String email,@NotBlank @Size(max=30) String nickname) {}
    public static class Invitation {
        public Long id, userId, createdBy;
        public String email,nickname,status;
        public LocalDateTime createdAt,updatedAt;
    }
    public record DeleteUserRequest(@NotNull LocalDateTime expectedUpdatedAt,@NotBlank @Size(max=255) String confirmationEmail) {}
    public record VersionRequest(@NotNull LocalDateTime expectedUpdatedAt) {}
    public record DefaultsRequest(@NotBlank @Size(max=40) String userLevel,@Min(1) @Max(100000) int tripLimit,
            @Min(1) @Max(1200) int tripRetentionMonths,@NotNull Boolean canShare,@NotNull Boolean canVideo,
            @NotNull @Pattern(regexp="INHERIT|ALLOW|DENY") String customMusicAccess,@NotNull LocalDateTime expectedUpdatedAt) {}
    public static class Defaults {
        public String userLevel,customMusicAccess;
        public Integer tripLimit,tripRetentionMonths;
        public Boolean canShare,canVideo;
        public LocalDateTime updatedAt;
    }
    public static class Trip {
        public Boolean expired;
        public Long id,userId,photos,checkins,activeShares;
        public String email,nickname,title,destinationName,status,visibility;
        public LocalDateTime createdAt,updatedAt,expiresAt;
    }
    public record TripAction(@NotNull @Pattern(regexp="ARCHIVE|UNARCHIVE|REVOKE_SHARES|DELETE") String action,
            @NotNull LocalDateTime expectedUpdatedAt,@Size(max=200) String confirmation) {}
    public static class Media {
        public Long id,userId,tripId,fileSize;
        public String email,title,status,kind;
        public LocalDateTime createdAt,updatedAt;
    }
    public record MediaDelete(@NotNull LocalDateTime expectedUpdatedAt,@NotBlank String confirmation) {}
    public static class Audit {
        public Long id,adminId,userId;
        public String action,details;
        public LocalDateTime createdAt;
    }
    public static class Job {
        public Long id,requestedBy;
        public String kind,status,result;
        public LocalDateTime createdAt,startedAt,completedAt;
    }
    public record JobRequest(@NotNull @Pattern(regexp="TRIPS|ACCOUNTS|MUSIC") String kind,
            @NotBlank String confirmation) {}
    public record Maintenance(long expiredTrips,long dueAccounts,long musicFiles,long pendingVideoFiles) {}
}
