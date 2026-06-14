package com.wshake.infra.log;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wshake.common.constant.SecurityConstants;
import com.wshake.infra.security.SaTokenConfigure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Controller 请求日志切面。
 *
 * <p>记录：method / uri / params / userId / 耗时 / 返回值摘要 / 异常。
 *
 * @author wshake
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class RequestLogAspect {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Pointcut("execution(* com.wshake.api.controller..*(..))")
    public void controllerPointcut() {}

    @Around("controllerPointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        String method = pjp.getSignature().toShortString();
        Object[] args = pjp.getArgs();

        Long userId = SaTokenConfigure.currentUserIdOrNull();
        if (userId != null) {
            MDC.put(SecurityConstants.MDC_USER_ID, String.valueOf(userId));
        }

        log.info("[REQ] method={} args={}", method, safeToJson(args));

        try {
            Object result = pjp.proceed();
            long cost = System.currentTimeMillis() - start;
            log.info("[RES] method={} cost={}ms result={}", method, cost, safeToJson(result));
            return result;
        } catch (Throwable t) {
            long cost = System.currentTimeMillis() - start;
            log.error("[ERR] method={} cost={}ms", method, cost, t);
            throw t;
        } finally {
            MDC.remove(SecurityConstants.MDC_USER_ID);
        }
    }

    private String safeToJson(Object o) {
        if (o == null) return "null";
        try {
            String json = objectMapper.writeValueAsString(o);
            if (json.length() > 500) {
                return json.substring(0, 500) + "...(truncated)";
            }
            return json;
        } catch (JsonProcessingException e) {
            return String.valueOf(o);
        }
    }
}
