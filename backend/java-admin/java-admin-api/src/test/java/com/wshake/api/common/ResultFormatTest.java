package com.wshake.api.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wshake.common.result.Result;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link Result} 序列化测试（Q13 决策）。
 *
 * <p>验证响应体严格 3 字段：{@code code}, {@code msg}, {@code data}。
 * <p>{@code traceId} <strong>不</strong>出现在 body 中。
 *
 * @author wshake
 */
class ResultFormatTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void result_ok_hasOnlyThreeFields() throws Exception {
        Result<String> r = Result.ok("hello");

        String json = mapper.writeValueAsString(r);

        // 严格 3 字段
        assertThat(json).contains("\"code\":0");
        assertThat(json).contains("\"msg\":\"ok\"");
        assertThat(json).contains("\"data\":\"hello\"");
        // 验证不存在的字段
        assertThat(json).doesNotContain("\"traceId\"");
        assertThat(json).doesNotContain("\"message\"");   // 旧字段名
    }

    @Test
    void result_error_hasOnlyThreeFields() throws Exception {
        Result<Object> r = Result.error(2002, "凭证错误");

        String json = mapper.writeValueAsString(r);

        assertThat(json).contains("\"code\":2002");
        assertThat(json).contains("\"msg\":\"凭证错误\"");
        assertThat(json).doesNotContain("\"data\"");      // error 不带 data
        assertThat(json).doesNotContain("\"traceId\"");
        assertThat(json).doesNotContain("\"message\"");
    }

    @Test
    void result_isSuccess() {
        assertThat(Result.ok().isSuccess()).isTrue();
        assertThat(Result.error(1, "x").isSuccess()).isFalse();
    }
}
