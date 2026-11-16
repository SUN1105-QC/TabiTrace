package com.tabitrace.admin;

import com.tabitrace.admin.AdminDtos.*;
import com.tabitrace.common.BusinessException;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class SupportService {
    private final AdminMapper mapper;
    private final AdminService admin;
    private final UserMapper users;
    public SupportService(AdminMapper mapper, AdminService admin, UserMapper users) {
        this.mapper = mapper;
        this.admin = admin;
        this.users = users;
    }

    public List<MessageView> list(Long userId) {
        return mapper.messages(userId);
    }

    @Transactional
    public MessageView send(Long userId, MessageRequest r) {
        var u = users.lockById(userId);
        if (u == null || !"USER".equals(u.role) || !"ACTIVE".equals(u.status)) {
            throw new BusinessException("USER_DISABLED", "账号当前不可用", HttpStatus.FORBIDDEN);
        }
        if (mapper.dailyMessages(userId) >= 10) {
            throw new BusinessException("MESSAGE_LIMIT", "每天最多发送 10 条留言，请等待管理员回复", HttpStatus.TOO_MANY_REQUESTS);
        }
        MessageView m = new MessageView();
        m.userId = userId;
        m.subject = r.subject().strip();
        m.content = r.content().strip();
        mapper.insertMessage(m);
        return mapper.message(m.id);
    }

    public List<MessageView> inbox(Long adminId, String status, int page) {
        admin.requireAdmin(adminId);
        return mapper.allMessages(status, (page - 1) * 25, 25);
    }

    public MessagePage inboxPage(Long adminId, String status, int page) {
        admin.requireAdmin(adminId);
        return new MessagePage(mapper.allMessages(status, (page - 1) * 25, 25), mapper.messageCount(status), page, 25);
    }

    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public MessageView reply(Long adminId, Long id, ReplyRequest r) {
        admin.lockForWrite(adminId);
        if (mapper.lockMessage(id) == null) {
            throw new BusinessException("MESSAGE_NOT_FOUND", "留言不存在", HttpStatus.NOT_FOUND);
        }
        mapper.reply(id, r.reply().strip());
        MessageView m = mapper.message(id);
        mapper.audit(adminId, m.userId, "REPLY_MESSAGE", "requestId=" + java.util.UUID.randomUUID() + ";result=SUCCESS;messageId=" + id);
        return m;
    }
}
