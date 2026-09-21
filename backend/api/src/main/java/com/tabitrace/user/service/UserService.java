package com.tabitrace.user.service;

import com.tabitrace.auth.dto.AuthDtos.UserView;
import com.tabitrace.auth.service.AuthService;
import com.tabitrace.common.BusinessException;
import com.tabitrace.user.dto.UserDtos.UpdateUserRequest;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final UserMapper mapper;
    public UserService(UserMapper mapper){this.mapper=mapper;}
    public UserView get(Long id){UserEntity u=mapper.findById(id);if(u==null)throw new BusinessException("USER_NOT_FOUND","用户不存在");return AuthService.view(u);}
    @Transactional public UserView update(Long id,UpdateUserRequest r){
        UserEntity u=mapper.findById(id);if(u==null)throw new BusinessException("USER_NOT_FOUND","用户不存在");
        if(r.nickname()!=null)u.nickname=r.nickname(); if(r.avatarUrl()!=null)u.avatarUrl=r.avatarUrl(); if(r.locale()!=null)u.locale=r.locale(); if(r.timezone()!=null)u.timezone=r.timezone();
        if(r.defaultVisibility()!=null){if(!r.defaultVisibility().equals("PRIVATE")&&!r.defaultVisibility().equals("UNLISTED"))throw new BusinessException("INVALID_VISIBILITY","可见性不正确");u.defaultVisibility=r.defaultVisibility();}
        if(r.emailNotifications()!=null)u.emailNotifications=r.emailNotifications(); mapper.updateProfile(u); return AuthService.view(u);
    }
}
