package com.wshake.common.result;

import lombok.Getter;

/**
 * 业务码枚举。
 *
 * <p>分段规则（Q13 决策后，移除 3xxx 限流段）：
 * <ul>
 *     <li>{@code 0} 成功</li>
 *     <li>{@code 1xxx} 通用（参数/远程/内部）</li>
 *     <li>{@code 2xxx} 鉴权（2001 未登录 / 2002 凭证错误 / 2003 token 过期 / 2004 无权限）</li>
 *     <li>{@code 4xxx} 业务（保留）</li>
 * </ul>
 *
 * @author wshake
 */
@Getter
public enum ResultCode {

    SUCCESS(0, "ok"),

    PARAM_INVALID(1001, "参数错误"),
    REMOTE_CALL_FAILED(1002, "远程调用失败"),
    INTERNAL_ERROR(1003, "内部错误"),

    AUTH_NOT_LOGIN(2001, "请登录"),
    AUTH_INVALID_CREDENTIALS(2002, "凭证错误"),
    AUTH_TOKEN_EXPIRED(2003, "登录已过期"),
    AUTH_FORBIDDEN(2004, "无权限");

    private final int code;
    private final String msg;

    ResultCode(int code, String msg) {
        this.code = code;
        this.msg = msg;
    }
}
