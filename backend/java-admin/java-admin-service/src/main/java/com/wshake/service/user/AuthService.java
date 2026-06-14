package com.wshake.service.user;

import cn.dev33.satoken.secure.BCrypt;
import com.wshake.common.exception.AuthException;
import com.wshake.service.entity.SysUser;
import com.wshake.service.repository.SysUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 鉴权 Service。
 *
 * <p>负责登录校验：用户名 + 密码（BCrypt）。
 *
 * @author wshake
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserRepository sysUserRepository;

    /**
     * 登录校验。校验通过后<strong>不</strong>写入 Sa-Token 登录态（由 Controller 调 {@code StpUtil.login}）。
     *
     * @param username 用户名
     * @param password 明文密码
     * @return 用户实体
     * @throws AuthException 用户不存在 / 密码错误 / 账号禁用
     */
    public SysUser login(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw AuthException.invalidCredentials();
        }

        SysUser user = sysUserRepository.findByUsername(username);
        if (user == null) {
            log.warn("[AUTH] login failed username={} reason=USER_NOT_FOUND", username);
            throw AuthException.invalidCredentials();
        }

        if (user.getStatus() == null || user.getStatus() != 1) {
            log.warn("[AUTH] login failed username={} reason=USER_DISABLED", username);
            throw AuthException.forbidden();
        }

        if (!BCrypt.checkpw(password, user.getPassword())) {
            log.warn("[AUTH] login failed username={} reason=BAD_PASSWORD", username);
            throw AuthException.invalidCredentials();
        }

        log.info("[AUTH] login success userId={} username={}", user.getId(), username);
        return user;
    }
}
