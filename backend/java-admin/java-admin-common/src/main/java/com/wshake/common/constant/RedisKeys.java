package com.wshake.common.constant;

/**
 * Redis Key 前缀与命名空间。
 *
 * @author wshake
 */
public final class RedisKeys {

    /** Sa-Token 业务 key 前缀（sa-token-redisson 内部使用） */
    public static final String SA_TOKEN_PREFIX = "satoken:";

    /** traceId MDC key */
    public static final String MDC_TRACE_ID = "traceId";

    private RedisKeys() {}
}
