package com.tabitrace.admin;

import com.tabitrace.common.BusinessException;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AccountPermissions {
    private final UserMapper users;
    public AccountPermissions(UserMapper users) {
        this.users = users;
    }

    public void require(Long userId, String feature) {
        var u = users.findById(userId);
        if (u == null || !"ACTIVE".equals(u.status) || !"USER".equals(u.role)) {
            throw new BusinessException("USER_DISABLED", "账号当前不可用", HttpStatus.FORBIDDEN);
        }
        boolean allowed = switch (feature) {
            case "SHARE" -> Boolean.TRUE.equals(u.canShare);
            case "VIDEO" -> Boolean.TRUE.equals(u.canVideo);
            default -> false;
        };
        if (!allowed) {
            throw new BusinessException("FEATURE_DISABLED", "当前账号未开通此功能，请联系管理员申请", HttpStatus.FORBIDDEN);
        }
    }
}
