package com.wshake.api.vo;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户信息 VO（{@code /api/v1/auth/info} 响应）。
 *
 * @author wshake
 */
@Data
@AllArgsConstructor
public class UserInfoVO {

    private Long id;

    private String username;

    private String nickname;

    private Integer status;

    private LocalDateTime createTime;
}
