package com.tabitrace.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class UserDtos {
    private UserDtos() {}
    /**
     * 只更新当前登录用户；未传的字段保持不变。头像走单独的上传接口。
     * 只接受真正有消费方的设置：新旅行的可见性由分享链接决定、通知邮件尚未开通，所以 defaultVisibility / emailNotifications 不在这里（传了也会被忽略）
     */
    public record UpdateUserRequest(@Size(max=100) String nickname,@Size(max=500) String bio,@Size(max=20) String locale,@Size(max=50) String timezone,
                                    @Size(max=10) String distanceUnit,Boolean shareExactLocation,Integer shareLinkExpiryDays,
                                    Boolean notifyTripReminder,Boolean notifyStory,Boolean notifyAchievement,Boolean notifyShare) {}
    /** 注销账号：需要再次输入密码 */
    public record DeleteAccountRequest(@NotBlank @Size(max=100) String password) {}
    /** scheduledAt（UTC）之后账号与全部数据会被删除；之前重新登录可以撤销 */
    public record AccountDeletionView(LocalDateTime scheduledAt, int coolingOffDays) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword,@NotBlank @Size(min=8,max=100) String newPassword,String refreshToken) {}
    public record AvatarPresignRequest(@NotBlank @Size(max=255) String fileName,@NotBlank String contentType,Long fileSize) {}
    /** smallKey：同时上传的 160×160 小图（可选，旧客户端不传） */
    public record AvatarRequest(@NotBlank @Size(max=500) String storageKey,@Size(max=500) String smallKey) {}

    public record TripPlanView(Long tripId,String title,String destinationName,LocalDate startDate,LocalDate endDate,String planType,String status,
                               Integer amount,String currency,String provider,LocalDateTime paidAt) {}
    /** 设置中心概览：旅行统计 + 按旅行计的 Trip Pro 状态 */
    public record AccountOverview(int trips,int places,int photos,int proTrips,int activeFreeTrips,int freeTripLimit,
                                  /** 金额为最小货币单位（分）：单次旅行 Trip Pro、买断终身 Pro */
                                  int tripProAmount,int lifetimeAmount,String tripProCurrency,boolean lifetimePro,List<TripPlanView> plans) {}
    public record SessionView(Long id,String device,boolean mobile,LocalDateTime signedInAt,LocalDateTime lastActiveAt,LocalDateTime expiresAt,boolean current) {}
    public record RevokeOthersRequest(String refreshToken) {}
}
