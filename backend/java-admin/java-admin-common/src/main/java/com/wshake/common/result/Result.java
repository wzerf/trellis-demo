package com.wshake.common.result;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 统一响应体（3 字段 Q13 决策）。
 *
 * <p>严格 3 字段：{@code code}, {@code msg}, {@code data}。
 * <p>{@code traceId} <strong>不</strong> 出现在 body 中；通过响应头 {@code X-Trace-Id} 暴露。
 * <p>{@code data} 在 error 时为 {@code null}，Jackson 通过 {@link JsonInclude} 不输出。
 *
 * @param <T> 业务数据类型
 * @author wshake
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Result<T> {

    /** 业务码：0 = 成功；非 0 见 {@link ResultCode} */
    private int code;

    /** 人类可读消息（Q13 决策：原 message → msg） */
    private String msg;

    /** 业务数据；error 时为 {@code null}（Jackson 不输出） */
    private T data;

    public Result() {}

    public Result(int code, String msg, T data) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    public static <T> Result<T> ok() {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMsg(), null);
    }

    public static <T> Result<T> ok(T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMsg(), data);
    }

    public static <T> Result<T> ok(T data, String msg) {
        return new Result<>(ResultCode.SUCCESS.getCode(), msg, data);
    }

    public static <T> Result<T> error(ResultCode code) {
        return new Result<>(code.getCode(), code.getMsg(), null);
    }

    public static <T> Result<T> error(int code, String msg) {
        return new Result<>(code, msg, null);
    }

    public static <T> Result<T> error(ResultCode code, String msg) {
        return new Result<>(code.getCode(), msg, null);
    }

    @JsonIgnore
    public boolean isSuccess() {
        return this.code == ResultCode.SUCCESS.getCode();
    }
}
