package com.tabitrace.admin;

import com.tabitrace.user.entity.UserEntity;
import org.springframework.stereotype.Service;

/** 只有新注册账号读取全局默认值；保存设置不会批量改动已有账号。 */
@Service
public class RegistrationDefaultsService {
    private final AdminModuleMapper mapper;
    public RegistrationDefaultsService(AdminModuleMapper mapper) { this.mapper=mapper; }
    public void apply(UserEntity u) {
        // 注册事务持有此行锁到账号创建完成，与管理员保存默认值确定先后顺序。
        var d=mapper.lockDefaults();
        u.userLevel=d.userLevel;u.tripLimit=d.tripLimit;u.tripRetentionMonths=d.tripRetentionMonths;
        u.canShare=d.canShare;u.canVideo=d.canVideo;u.customMusicAccess=d.customMusicAccess;
    }
    public void registered(String email) { mapper.acceptInvitation(email); }
}
