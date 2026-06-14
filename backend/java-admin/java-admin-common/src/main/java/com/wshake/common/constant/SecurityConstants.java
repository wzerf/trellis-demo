package com.wshake.common.constant;

/**
 * 鉴权相关常量。
 *
 * @author wshake
 */
public final class SecurityConstants {

    /** Sa-Token token 名称（同时也是 cookie / header 名） */
    public static final String TOKEN_NAME = "satoken";

    /** 默认角色：admin */
    public static final String ROLE_ADMIN = "admin";

    /** 登录后用户信息 key（MDC 用） */
    public static final String MDC_USER_ID = "userId";

    private SecurityConstants() {}
}
