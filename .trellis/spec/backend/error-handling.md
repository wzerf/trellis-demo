# Error Handling 规范

> 统一错误处理：业务码 + 响应体 + 异常 + 全局兜底。

---

## 1. 选型

- **响应体严格 3 字段**（Q13 决策）：`{code, msg, data}`，**无** traceId
- **traceId 仅响应头** `X-Trace-Id`
- **业务码枚举**（`common.enums.BusinessCode`）
- **可选 `BusinessException` + `GlobalExceptionHandler` 兜底**（**2026-06-14 演进：项目内未启用抛异常模式**，全部走 `Result.error()` 返回）

---

## 2. 业务码

### 2.1 码段划分

| 段              | 用途                                  | 范围      |
| --------------- | ------------------------------------- | --------- |
| `0`             | 成功                                  | 0         |
| `1xxx`          | 业务一般错误                          | 1000-1999 |
| `2xxx`          | 业务特定错误                          | 2000-2999 |
| **`3xxx` 空缺** | **留给未来限流**（Q4 决策本期无限流） | 3000-3999 |
| `4xxx`          | HTTP 状态码对齐                       | 4000-4999 |
| `5xxx`          | 服务器内部                            | 5000-5999 |

### 2.2 命名（`BusinessCode` enum）

```java
package com.wshake.common.enums;

public enum BusinessCode {
    SUCCESS(0, "ok"),

    BAD_REQUEST(4000, "请求参数错误"),
    UNAUTHORIZED(4001, "未登录"),
    FORBIDDEN(4003, "无权限"),
    NOT_FOUND(4004, "资源不存在"),
    CONFLICT(4009, "资源冲突"),

    INTERNAL_ERROR(5000, "服务器内部错误");

    private final int code;
    private final String message;

    BusinessCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() { return code; }
    public String getMessage() { return message; }
}
```

**未来扩展**：

- `TOO_MANY_REQUESTS(3429, "请求过于频繁")`（限流码）
- `USER_NOT_FOUND(2001, "用户不存在")` / `PASSWORD_INVALID(2002, "密码错误")`（业务特定）

---

## 3. 响应体 `Result`（`common.result.Result`）

### 3.1 字段（严格 3 字段）

```java
package com.wshake.common.result;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Result<T> {

    private int code;
    private String msg;
    private T data;

    @JsonIgnore
    public boolean isSuccess() {
        return code == BusinessCode.SUCCESS.getCode();
    }

    public static <T> Result<T> ok() {
        return ok(null);
    }

    public static <T> Result<T> ok(T data) {
        Result<T> r = new Result<>();
        r.code = BusinessCode.SUCCESS.getCode();
        r.msg = BusinessCode.SUCCESS.getMessage();
        r.data = data;
        return r;
    }

    public static <T> Result<T> error(int code, String msg) {
        Result<T> r = new Result<>();
        r.code = code;
        r.msg = msg;
        return r;
    }

    public static <T> Result<T> error(BusinessCode bc) {
        return error(bc.getCode(), bc.getMessage());
    }
}
```

要点：

- **`@JsonInclude(NON_NULL)`**：`data == null` 时 `data` 字段被省略（响应体可能只有 2 字段）
- **`@JsonIgnore` on `isSuccess()`**：序列化时**不暴露** success 布尔字段（保持 3 字段）
- **Jackson 默认 `null` 不序列化**——配合 `@JsonInclude(NON_NULL)` 更明确

### 3.2 序列化结果示例

成功：

```json
{ "code": 0, "msg": "ok", "data": { "id": 1, "username": "admin" } }
```

成功但 data 为空：

```json
{ "code": 0, "msg": "ok" }
```

错误：

```json
{ "code": 4001, "msg": "未登录" }
```

---

## 4. 异常处理（**双模式**）

### 4.1 模式 A：直接 `Result.error()` 返回（**项目内**主流）

```java
@PostMapping("/login")
public Result<String> login(@RequestBody @Valid LoginRequest req) {
    SysUser user = sysUserRepository.findByUsername(req.getUsername());
    if (user == null) {
        return Result.error(2001, "用户不存在");
    }
    if (!SaSecureUtil.bcryptMatch(req.getPassword(), user.getPasswordHash())) {
        return Result.error(2002, "密码错误");
    }
    String token = StpUtil.login(user.getId());
    return Result.ok(token);
}
```

**优点**：

- 一目了然，每个错误路径显式列
- IDE 跳到 error 调用方便
- 不需要 `try-catch`

**缺点**：

- 业务 Service 内**不能**抛异常被全局兜（因为全局兜可能走别的格式）
- 业务码散落各 Service，维护成本略高

### 4.2 模式 B：`BusinessException` + `GlobalExceptionHandler`（**未启用**，留扩展点）

**当前项目状态**：`BusinessException` 已在 `common.exception` 占位（不删），但**没有**自定义 `GlobalExceptionHandler` 兜底——所有错误都走模式 A。

**未来启用**：

```java
// common.exception.BusinessException
public class BusinessException extends RuntimeException {
    private final int code;
    public BusinessException(BusinessCode bc) {
        super(bc.getMessage());
        this.code = bc.getCode();
    }
    public int getCode() { return code; }
}

// infra.exception.GlobalExceptionHandler
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Result.error(4000, msg);
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleAll(Exception e) {
        log.error("unhandled exception", e);
        return Result.error(5000, "服务器内部错误");
    }
}
```

⚠️ **2026-06-14 演进决策**：

- 项目**当前不用** `BusinessException`（Service 内用 `Result.error()` 返回）
- `GlobalExceptionHandler` **保留**（项目内有同名类，**只**处理 Sa-Token 401 等**框架**抛出的异常）
- 业务抛异常走 handler，业务码控制走显式 `Result.error()`

### 4.3 框架异常（**必须**有 `GlobalExceptionHandler` 兜底）

- `NotLoginException`（Sa-Token 401）→ 转 `Result.error(4001, "未登录")`
- `NotRoleException` / `NotPermissionException`（Sa-Token 403）→ 转 `Result.error(4003, "无权限")`
- `MethodArgumentNotValidException`（Spring Validation 400）→ 转 `Result.error(4000, "...")`
- 兜底 `Exception` → `Result.error(5000, "服务器内部错误")`

---

## 5. Sa-Token 异常处理（`GlobalExceptionHandler.handleNotLogin`）

```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotLoginException.class)
    public Result<Void> handleNotLogin(NotLoginException e) {
        log.debug("not login: type={}", e.getType());
        return Result.error(4001, "未登录");
    }

    @ExceptionHandler(NotRoleException.class)
    public Result<Void> handleNotRole(NotRoleException e) {
        return Result.error(4003, "无权限");
    }

    // ... 其他
}
```

---

## 6. Controller `@Valid` 校验

```java
public record LoginRequest(
        @NotBlank(message = "用户名不能为空")
        @Size(min = 3, max = 64)
        String username,

        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 64)
        String password
) {}

@PostMapping("/login")
public Result<String> login(@RequestBody @Valid LoginRequest req) {
    // ...
}
```

校验失败抛 `MethodArgumentNotValidException` → handler 转 `Result.error(4000, ...)`。

---

## 7. HTTP 状态码 vs 业务码

| 维度              | 用途                  | 规则                                                             |
| ----------------- | --------------------- | ---------------------------------------------------------------- |
| **HTTP 状态码**   | 协议层（200/401/500） | 成功 200；业务错误**也**用 200，body 内 `code != 0` 表示业务失败 |
| **业务码 `code`** | 业务层                | `0` 成功；`1xxx-5xxx` 业务失败                                   |

**为什么错误也用 HTTP 200**：

- 业务失败是"客户端发了一个能识别的请求，服务器也处理了，只是业务规则不通过"——HTTP 协议层**正常**完成
- 真正的"协议级失败"（如 401 unauthorized）由 Sa-Token 直接返回（如 `satoken` 缺失 → HTTP 401）
- 业务失败用 200 + body code，避免 HTTP 层和业务层语义冲突

**例外**：Sa-Token 401 路径**走 HTTP 401**（因为 SaTokenConfig.WebConfig 注册的 `SaInterceptor` 直接返回 401）。

---

## 8. 常见错误（防回归）

| 错误                                                  | 现象            | 规避                                            |
| ----------------------------------------------------- | --------------- | ----------------------------------------------- |
| 响应体带 `traceId`                                    | 字段 3 变 4     | traceId 只在响应头                              |
| 响应体带 `success` 字段                               | 字段 3 变 4     | `@JsonIgnore` on `isSuccess()`                  |
| 业务失败用 HTTP 4xx/5xx                               | 跟协议层耦合    | HTTP 200 + body code                            |
| 业务码不分类散落                                      | 难维护          | 统一枚举 `BusinessCode`                         |
| `@ExceptionHandler(Exception.class)` 漏打日志         | 出错无迹        | `log.error("unhandled", e)`                     |
| 校验失败返回 `e.getMessage()`                         | 用户看到框架栈  | 转 `4000 + 字段+msg`                            |
| 业务 Service 抛 `BusinessException` 但 handler 未启用 | 500 兜底走 5000 | 项目**当前**统一 `Result.error()`，**不**抛异常 |
| 业务 Service 抛 `RuntimeException` 走兜底             | 5000 通用错     | 抛之前用 `log.error` 留痕                       |

---

## 9. 不在范围内

- ❌ i18n 错误消息（统一中英固定字符串）
- ❌ 错误码到文档自动生成（手动维护 enum）
- ❌ 客户端 retry 策略（交给调用方）

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
