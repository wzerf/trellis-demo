package com.wshake.infra.exception;

import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.exception.NotRoleException;
import cn.dev33.satoken.exception.SaTokenException;
import com.wshake.common.exception.AuthException;
import com.wshake.common.exception.BizException;
import com.wshake.common.result.Result;
import com.wshake.common.result.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * 全局异常处理器。
 *
 * <p>统一转 {@link Result}。traceId 不在 body（Q13 决策），仅在响应头。
 *
 * @author wshake
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public ResponseEntity<Result<Object>> handleBiz(BizException e) {
        log.warn("[BIZ] code={} msg={} traceId={}", e.getCode(), e.getMessage(), MDC.get("traceId"));
        HttpStatus status = e.getCode() >= 4000 ? HttpStatus.BAD_REQUEST : HttpStatus.OK;
        return ResponseEntity.status(status).body(Result.error(e.getCode(), e.getMessage()));
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Result<Object>> handleAuth(AuthException e) {
        log.warn("[AUTH] code={} msg={} traceId={}", e.getCode(), e.getMessage(), MDC.get("traceId"));
        HttpStatus status = e.getCode() == ResultCode.AUTH_FORBIDDEN.getCode()
                ? HttpStatus.FORBIDDEN
                : HttpStatus.UNAUTHORIZED;
        return ResponseEntity.status(status).body(Result.error(e.getCode(), e.getMessage()));
    }

    @ExceptionHandler(NotLoginException.class)
    public ResponseEntity<Result<Object>> handleNotLogin(NotLoginException e) {
        log.warn("[SA_TOKEN] notLogin type={} msg={} traceId={}", e.getType(), e.getMessage(), MDC.get("traceId"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Result.error(ResultCode.AUTH_NOT_LOGIN));
    }

    @ExceptionHandler(NotRoleException.class)
    public ResponseEntity<Result<Object>> handleNotRole(NotRoleException e) {
        log.warn("[SA_TOKEN] notRole role={} traceId={}", e.getRole(), MDC.get("traceId"));
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Result.error(ResultCode.AUTH_FORBIDDEN, "无权限：" + e.getRole()));
    }

    @ExceptionHandler(SaTokenException.class)
    public ResponseEntity<Result<Object>> handleSaToken(SaTokenException e) {
        log.warn("[SA_TOKEN] {} traceId={}", e.getMessage(), MDC.get("traceId"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Result.error(ResultCode.AUTH_NOT_LOGIN, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Object>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + " " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("[VALIDATION] {} traceId={}", msg, MDC.get("traceId"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(ResultCode.PARAM_INVALID, msg));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result<Object>> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("[REQ_BODY] not readable traceId={}", MDC.get("traceId"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(ResultCode.PARAM_INVALID, "请求体格式错误"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Object>> handleAny(Exception e) {
        log.error("[UNEXPECTED] {} traceId={}", e.getClass().getSimpleName(), MDC.get("traceId"), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(ResultCode.INTERNAL_ERROR, "内部错误"));
    }
}
