package com.wshake.api.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.wshake.api.dto.LoginRequest;
import com.wshake.api.vo.LoginResponse;
import com.wshake.api.vo.UserInfoVO;
import com.wshake.common.exception.AuthException;
import com.wshake.common.exception.BizException;
import com.wshake.common.result.Result;
import com.wshake.common.result.ResultCode;
import com.wshake.service.entity.SysUser;
import com.wshake.service.user.AuthService;
import com.wshake.service.user.SysUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 鉴权 Controller。
 *
 * @author wshake
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SysUserService sysUserService;

    /**
     * 登录。
     */
    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        SysUser user = authService.login(req.getUsername(), req.getPassword());
        StpUtil.login(user.getId());
        String token = StpUtil.getTokenValue();
        return Result.ok(new LoginResponse(token, user.getId(), user.getUsername(), user.getNickname()));
    }

    /**
     * 登出。
     */
    @PostMapping("/logout")
    public Result<Void> logout() {
        StpUtil.logout();
        return Result.ok();
    }

    /**
     * 当前用户信息。
     */
    @GetMapping("/info")
    public Result<UserInfoVO> info() {
        if (!StpUtil.isLogin()) {
            throw AuthException.notLogin();
        }
        Long userId = StpUtil.getLoginIdAsLong();
        SysUser user = sysUserService.findById(userId);
        if (user == null) {
            throw new BizException(ResultCode.INTERNAL_ERROR, "用户不存在");
        }
        return Result.ok(new UserInfoVO(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getStatus(),
                user.getCreateTime()
        ));
    }
}
