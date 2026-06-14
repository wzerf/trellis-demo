package com.wshake.infra.log;

import com.wshake.common.constant.RedisKeys;
import com.wshake.common.util.TraceIdUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * traceId 入口 / 出口过滤器。
 *
 * <p>职责：
 * <ul>
 *     <li>从 {@code X-Trace-Id} header 读取，缺失则生成 UUID</li>
 *     <li>写入 {@link MDC}，供 Logback pattern 使用</li>
 *     <li>写响应头 {@code X-Trace-Id}（Q13 决策：响应体不含 traceId）</li>
 *     <li>{@code finally} 中清理 {@code MDC} 防内存泄漏</li>
 * </ul>
 *
 * @author wshake
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String traceId = TraceIdUtil.resolveOrGenerate(request.getHeader(TraceIdUtil.HEADER));
        MDC.put(RedisKeys.MDC_TRACE_ID, traceId);
        response.setHeader(TraceIdUtil.HEADER, traceId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(RedisKeys.MDC_TRACE_ID);
        }
    }
}
