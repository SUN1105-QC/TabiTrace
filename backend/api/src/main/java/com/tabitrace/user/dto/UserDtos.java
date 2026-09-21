package com.tabitrace.user.dto;

import jakarta.validation.constraints.Size;

public final class UserDtos {
    private UserDtos() {}
    public record UpdateUserRequest(@Size(max=100) String nickname,@Size(max=500) String avatarUrl,@Size(max=20) String locale,@Size(max=50) String timezone,String defaultVisibility,Boolean emailNotifications) {}
}
