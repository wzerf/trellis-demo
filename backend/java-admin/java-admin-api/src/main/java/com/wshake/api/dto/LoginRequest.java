package com.wshake.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 登录请求 DTO。
 *
 * @author wshake
 */
@Data
public class LoginRequest {

    @NotBlank(message = "不能为空")
    @Size(min = 3, max = 64, message = "长度 3-64")
    private String username;

    @NotBlank(message = "不能为空")
    @Size(min = 6, max = 64, message = "长度 6-64")
    private String password;
}
