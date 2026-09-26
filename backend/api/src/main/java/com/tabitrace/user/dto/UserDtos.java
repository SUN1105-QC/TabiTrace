package com.tabitrace.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class UserDtos {
    private UserDtos() {}
    /** 只更新当前登录用户；未传的字段保持不变。头像走单独的上传接口 */
    public record UpdateUserRequest(@Size(max=100) String nickname,@Size(max=500) String bio,@Size(max=20) String locale,@Size(max=50) String timezone,
                                    @Size(max=10) String distanceUnit,String defaultVisibility,Boolean shareExactLocation,Integer shareLinkExpiryDays,
                                    Boolean emailNotifications,Boolean notifyTripReminder,Boolean notifyStory,Boolean notifyAchievement,Boolean notifyShare) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword,@NotBlank @Size(min=8,max=100) String newPassword,String refreshToken) {}
    public record AvatarPresignRequest(@NotBlank @Size(max=255) String fileName,@NotBlank String contentType,Long fileSize) {}
    public record AvatarRequest(@NotBlank @Size(max=500) String storageKey) {}

    public record TripPlanView(Long tripId,String title,String destinationName,LocalDate startDate,LocalDate endDate,String planType,String status,
                               Integer amount,String currency,String provider,LocalDateTime paidAt) {}
    /** 设置中心概览：旅行统计 + 按旅行计的 Trip Pro 状态 */
    public record AccountOverview(int trips,int places,int photos,int proTrips,int activeFreeTrips,int freeTripLimit,
                                  int tripProPrice,String tripProCurrency,List<TripPlanView> plans) {}
    public record SessionView(Long id,String device,boolean mobile,LocalDateTime signedInAt,LocalDateTime lastActiveAt,LocalDateTime expiresAt,boolean current) {}
    public record RevokeOthersRequest(String refreshToken) {}
}
