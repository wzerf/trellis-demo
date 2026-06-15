# Design — 为 java-admin 补全 knife4j 注解

> 与 prd.md 配套。本文件记录**技术设计**,不写执行步骤(执行步骤在 implement.md)。

---

## 1. 注解包路径(Q1 决策)

```java
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
```

依据:`knife4j-openapi3-jakarta-spring-boot-starter` 4.5.0 走 OpenAPI 3,Jakarta 命名空间(Spring Boot 3.x)。**禁止**用 `io.swagger.annotations.*`(那是 swagger v2,knife4j 4.x 不识别)。

---

## 2. AuthController 注解规划

### 2.1 类级别

```java
@Tag(name = "鉴权", description = "登录、登出、当前用户信息")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController { ... }
```

### 2.2 `/login`(`POST /api/v1/auth/login`)

- `@Operation(summary = "账号密码登录", description = "...")`
- 入参 `LoginRequest` 的字段 `@Schema` 描述会通过 `@Schema` 自动出现在请求体模型上
- 响应用 `@ApiResponses`:
  - `200`:成功 → `Result<LoginResponse>`
  - `400`:参数错误 → `Result<Void>` + `code=1001`
  - `401`:凭证错误 → `Result<Void>` + `code=2002`
- **不加** `@SecurityRequirement`(未登录)

### 2.3 `/logout`(`POST /api/v1/auth/logout`)

- `@Operation(summary = "登出", description = "...")`
- `@SecurityRequirement(name = "bearerAuth")`
- 响应:
  - `200`:成功 → `Result<Void>`
  - `401`:未登录 → `Result<Void>` + `code=2001`

### 2.4 `/info`(`GET /api/v1/auth/info`)

- `@Operation(summary = "当前登录用户信息", description = "...")`
- `@SecurityRequirement(name = "bearerAuth")`
- 响应:
  - `200`:成功 → `Result<UserInfoVO>`
  - `401`:未登录 → `Result<Void>` + `code=2001`

---

## 3. GlobalExceptionHandler 注解规划

### 3.1 类级别

```java
@Tag(name = "全局异常", description = "统一异常转 Result,每个 handler 对应一种 HTTP 状态")
@RestControllerAdvice
public class GlobalExceptionHandler { ... }
```

### 3.2 每个 handler 方法

每个 `@ExceptionHandler` 方法显式标 `@Operation` + `@ApiResponse`,否则 SpringDoc 不会把它们收录到 OpenAPI。

| Handler 方法                        | HTTP 状态 | 业务码    | `@Operation` summary  |
| ----------------------------------- | --------- | --------- | --------------------- |
| `handleBiz(BizException)`           | 200/400   | 1xxx/2xxx | "业务异常"            |
| `handleAuth(AuthException)`         | 401/403   | 2xxx      | "鉴权异常"            |
| `handleNotLogin(NotLoginException)` | 401       | 2001      | "Sa-Token 未登录"     |
| `handleNotRole(NotRoleException)`   | 403       | 2004      | "Sa-Token 无角色权限" |
| `handleSaToken(SaTokenException)`   | 401       | 2001      | "Sa-Token 异常"       |
| `handleValidation(...)`             | 400       | 1001      | "请求体校验失败"      |
| `handleNotReadable(...)`            | 400       | 1001      | "请求体无法解析"      |
| `handleAny(Exception)`              | 500       | 1003      | "服务器内部错误"      |

每个 `@ApiResponse` 用 `content = @Content(schema = @Schema(implementation = Result.class))`,**不**写 example(避免写死每个分支的 msg)。

---

## 4. DTO/VO 注解规划

### 4.1 `LoginRequest`(请求体)

```java
@Schema(description = "账号密码登录请求")
@Data
public class LoginRequest {

    @Schema(description = "用户名", example = "admin", minLength = 3, maxLength = 64, requiredMode = REQUIRED)
    @NotBlank
    @Size(min = 3, max = 64)
    private String username;

    @Schema(description = "密码(明文,仅登录时使用)", example = "admin123", minLength = 6, maxLength = 64, requiredMode = REQUIRED)
    @NotBlank
    @Size(min = 6, max = 64)
    private String password;
}
```

`requiredMode = Schema.RequiredMode.REQUIRED` 让 Knife4j 显示必填红星。

### 4.2 `LoginResponse`(响应体)

```java
@Schema(description = "登录成功响应")
@Data
@AllArgsConstructor
public class LoginResponse {

    @Schema(description = "Sa-Token token 值;前端写入请求头 satoken 或 Authorization: Bearer <token>")
    private String token;

    @Schema(description = "用户 ID", example = "1")
    private Long userId;

    @Schema(description = "用户名", example = "admin")
    private String username;

    @Schema(description = "昵称", example = "管理员")
    private String nickname;
}
```

### 4.3 `UserInfoVO`

```java
@Schema(description = "当前登录用户信息")
public class UserInfoVO {

    @Schema(description = "用户 ID", example = "1")
    private Long id;

    @Schema(description = "用户名", example = "admin")
    private String username;

    @Schema(description = "昵称", example = "管理员")
    private String nickname;

    @Schema(description = "状态:1=启用,0=禁用", example = "1", allowableValues = {"0", "1"})
    private Integer status;

    @Schema(description = "创建时间", example = "2026-06-14 12:00:00")
    private LocalDateTime createTime;
}
```

---

## 5. Result 公共响应体注解规划(Q2 决策)

`Result<T>`、`ObjectResult<T>`、`ListResult<T>` 字段加 `@Schema`,**类不加**:

```java
public class Result<T> {

    @Schema(description = "业务码;0=成功,非 0 见 ResultCode 枚举", example = "0")
    private int code;

    @Schema(description = "人类可读消息", example = "ok")
    private String msg;

    @Schema(description = "业务数据;error 时为 null(Jackson 不输出)")
    private T data;
}
```

`ObjectResult` / `ListResult` 字段同理。

**为什么不加类级 `@Schema(name="...")`**:会让 SpringDoc 把 `Result` 注册成独立 schema,泛型 `T` 解析失效;只注解字段能保留 `Result<LoginResponse>` 的泛型展开。

---

## 6. OpenApiConfig 配置类(新增)

放在 `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/config/OpenApiConfig.java`。

依赖:knife4j-openapi3 starter 已传递引入 `springdoc-openapi-starter-webmvc-ui`,**不**需要再加 `springdoc-openapi` 依赖。

### 6.1 内容

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("java-admin API 文档")
                .description("Treasure 后台管理系统接口")
                .version("1.0.0")
                .contact(new Contact().name("wshake")))
            .components(new Components()
                .addSecuritySchemes("bearerAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .in(SecurityScheme.In.HEADER)
                        .name("satoken")))
            .externalDocs(new ExternalDocumentation()
                .description("Knife4j 文档")
                .url("/doc.html"));
    }
}
```

### 6.2 决策点

- **bearer 名称 `bearerAuth`**:与 `@SecurityRequirement(name = "bearerAuth")` 对应
- **header 名称 `satoken`**:与 Sa-Token 默认读 header 一致;Knife4j 调试页面输入框会自动填到这个 header
- **不分组(tags 排序)**:SpringDoc 默认按类名扫描顺序展示;AuthController 是当前唯一的 Controller,顺序暂不需要固定

### 6.3 yml 不重复

yml 已有:

```yaml
knife4j:
  enable: true
  setting:
    language: zh_cn
```

**不**再加 `knife4j.openapi` 等 yml 字段(OpenApiConfig Java bean 已经覆盖 title/version/contact)。如果在 yml 又写一遍,Knife4j 4.x 会以 yml 为准、Java bean 被忽略(反过来也成立),但**单一来源更稳**。

---

## 7. application.yml 改动(Q3 决策)

只改 `application-dev.yml`,**不改** `application-prod.yml`:

- `dev` 已在 `knife4j.enable: true` + `language: zh_cn`,**不动**
- `prod` 已在 `knife4j.enable: ${KNIFE4J_ENABLE:false}`,**不动**(prod 文档关闭是合规要求)

`OpenApiConfig` 的 title / version / contact 走 Java bean,**不**通过 yml 配。

---

## 8. 不做的事(显式)

- **不改** `SysUser` Entity:Entity 是数据库模型;`passwordHash` / `createTime` 等字段不该出现在 API 文档;VO 才是 API 模型。
- **不**改 `service` / `repository` 层任何代码。
- **不**新增 DTO/VO;只注解现有的 3 个。
- **不**写 `@Hidden` 隐藏端点(当前没要隐藏的)。
- **不**写 `@Deprecated`(无废弃端点)。
- **不**改 Sa-Token 配置。
- **不**写新测试(注解是纯文档元数据,运行时无副作用;且现有 `GlobalExceptionHandlerTest` 覆盖了行为)。

---

## 9. 兼容性 / 回滚

- 注解只在编译期生成 OpenAPI 文档元数据,**不**影响运行时 HTTP 行为
- 改动文件全部 git 可追踪;`git restore` 可回退
- **风险点**:`Result` 加 `@Schema` 后,如果某个 Controller 写错返回类型(如裸 `List<>` 而不是 `Result<List<>>`),Knife4j 文档会有奇怪表现 → 这本来是 bug,本任务不掩盖

---

## 10. 验证策略(技术层)

| 验证                           | 命令                                                                                          | 期望                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 编译                           | `mvn -DskipTests -pl backend/java-admin -am compile`                                          | 退出 0,无 warning                                          |
| 测试                           | `mvn -pl backend/java-admin/java-admin-infra,java-admin-service,java-admin-api test`          | 全部 pass                                                  |
| OpenAPI 文档可访问(dev 启动后) | `curl -s http://localhost:8080/v3/api-docs \| jq '.tags'`                                     | 包含 `"name": "鉴权"` 和 `"name": "全局异常"`              |
| OpenAPI 文档含 schema          | `curl -s http://localhost:8080/v3/api-docs \| jq '.components.schemas \| keys'`               | 含 `LoginRequest`、`LoginResponse`、`UserInfoVO`、`Result` |
| 鉴权 scheme 注册               | `curl -s http://localhost:8080/v3/api-docs \| jq '.components.securitySchemes'`               | 含 `bearerAuth`                                            |
| prod yml 不退化                | `grep -n 'knife4j' backend/java-admin/java-admin-api/src/main/resources/application-prod.yml` | `knife4j.enable: ${KNIFE4J_ENABLE:false}` 仍在             |
