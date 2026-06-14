package com.wshake.infra.log;

import com.wshake.common.constant.RedisKeys;
import com.wshake.common.util.TraceIdUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * {@link TraceIdFilter} 单元测试。
 *
 * <p>Q13 决策验证：traceId 写入 MDC + 响应头 X-Trace-Id；finally 中清理。
 *
 * @author wshake
 */
class TraceIdFilterTest {

    private final TraceIdFilter filter = new TraceIdFilter();

    @Test
    void doFilter_generatesTraceIdWhenHeaderMissing() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/auth/info");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        AtomicReference<String> mdcDuringChain = new AtomicReference<>();

        filter.doFilter(req, resp, (r, s) -> {
            mdcDuringChain.set(MDC.get(RedisKeys.MDC_TRACE_ID));
        });

        assertThat(mdcDuringChain.get()).isNotBlank();
        assertThat(resp.getHeader(TraceIdUtil.HEADER)).isNotBlank();
        // 请求结束后 MDC 被清空
        assertThat(MDC.get(RedisKeys.MDC_TRACE_ID)).isNull();
        verify(chain);
    }

    @Test
    void doFilter_preservesIncomingTraceId() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/auth/info");
        req.addHeader(TraceIdUtil.HEADER, "test-trace-123");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        AtomicReference<String> mdcDuringChain = new AtomicReference<>();

        filter.doFilter(req, resp, (r, s) -> {
            mdcDuringChain.set(MDC.get(RedisKeys.MDC_TRACE_ID));
        });

        assertThat(mdcDuringChain.get()).isEqualTo("test-trace-123");
        assertThat(resp.getHeader(TraceIdUtil.HEADER)).isEqualTo("test-trace-123");
    }
}
