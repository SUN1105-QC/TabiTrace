package com.tabitrace.admin;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminDtos {
    private AdminDtos() {}
    public record UpdateUserRequest(@NotBlank @Size(max=40) String userLevel,
            @Min(1) @Max(100000) int tripLimit, @Min(1) @Max(1200) int tripRetentionMonths,
            @NotNull Boolean canShare, @NotNull Boolean canVideo,
            @NotNull @Pattern(regexp="INHERIT|ALLOW|DENY") String customMusicAccess,
            @NotNull @Pattern(regexp="ACTIVE|DISABLED") String status,
            @NotNull LocalDateTime expectedUpdatedAt) {}
    public record UserView(Long id,String email,String nickname,String role,String status,String userLevel,
            int tripLimit,int tripRetentionMonths,boolean canShare,boolean canVideo,String customMusicAccess,
            long trips,long photos,LocalDateTime createdAt,String avatarUrl,LocalDateTime updatedAt,
            LocalDateTime deletionScheduledAt,boolean deletionRequestedByAdmin,String deletionPreviousStatus) {}
    public record UserPage(List<UserView> items,long total,int page,int pageSize) {}
    public record MessagePage(List<MessageView> items,long total,int page,int pageSize) {}
    public record Overview(long users,long disabledUsers,long trips,long photos,long videos,long activeRenders,
            long expiringTrips,long pendingDeletionTrips,long openMessages,long photoBytes,long videoBytes) {}
    public record MessageRequest(@NotBlank @Size(max=120) String subject,@NotBlank @Size(max=5000) String content) {}
    public record ReplyRequest(@NotBlank @Size(max=5000) String reply) {}
    public static class MessageView {
        public Long id, userId;
        public String email,nickname,subject,content,reply,status;
        public LocalDateTime createdAt,repliedAt;
    }
    public static class UserRow extends com.tabitrace.user.entity.UserEntity { public long trips,photos; }
}
