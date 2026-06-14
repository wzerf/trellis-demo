package com.wshake.api.vo;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 登录响应 VO。
 *
 * @author wshake
 */
@Data
@AllArgsConstructor
public class LoginResponse {

    /** Sa-Token token 值（前端写入 {@code satoken} header） */
    private String token;

    private Long userId;

    private String username;

    private String nickname;
}
