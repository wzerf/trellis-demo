package com.wshake.common.util;

import java.util.UUID;

/**
 * traceId 工具。
 *
 * <p>从 {@code X-Trace-Id} header 读取，缺失则生成 UUID。
 *
 * @author wshake
 */
public final class TraceIdUtil {

    public static final String HEADER = "X-Trace-Id";

    public static String generate() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String resolveOrGenerate(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return generate();
        }
        return headerValue;
    }

    private TraceIdUtil() {}
}
