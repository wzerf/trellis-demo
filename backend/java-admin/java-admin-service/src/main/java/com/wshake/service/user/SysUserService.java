package com.wshake.service.user;

import com.wshake.service.entity.SysUser;
import com.wshake.service.repository.SysUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 系统用户 Service（业务侧）。
 *
 * <p>供 Controller 查询用户信息用；不参与鉴权流程。
 *
 * @author wshake
 */
@Service
@RequiredArgsConstructor
public class SysUserService {

    private final SysUserRepository sysUserRepository;

    public SysUser findById(Long id) {
        return sysUserRepository.findById(id);
    }

    public SysUser findByUsername(String username) {
        return sysUserRepository.findByUsername(username);
    }
}
