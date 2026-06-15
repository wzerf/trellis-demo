# 为 java-admin 补全 knife4j 注解

## Goal

让 `backend/java-admin` 在 Knife4j 4.5.0 文档上输出**完整、可用**的 OpenAPI 3 元数据:

- 每个 Controller 端点都有 `@Tag` / `@Operation` / `@Parameter` / `@ApiResponse`
- 每个 DTO / VO 都有 `@Schema`,字段有 description / example
- `Result<T>` 通用响应体的字段有 `@Schema` 描述
- `@RestControllerAdvice` 的异常映射能在文档里展示
- Knife4j 基础信息(title / version / contact)有配置

最终效果:`mvn spring-boot:run` 起服务后,浏览器打开 `http://localhost:8080/doc.html` 能看到分组 / 接口 / 模型 / 鉴权调试齐全的页面。

## 范围(明确)

| 类别             | 文件                                                                                                       | 改动                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Controller       | `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/controller/AuthController.java`            | 加 `@Tag` + 3 个 `@Operation` + `@Parameter` + `@ApiResponse` + `@SecurityRequirement` |
| Exception Advice | `backend/java-admin/java-admin-infra/src/main/java/com/wshake/infra/exception/GlobalExceptionHandler.java` | 加 `@Tag` + 每个 handler 方法 `@Operation` + 复用的 `@ApiResponse`                     |
| DTO              | `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/dto/LoginRequest.java`                     | 类 + 字段 `@Schema`                                                                    |
| VO               | `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/vo/LoginResponse.java`                     | 类 + 字段 `@Schema`                                                                    |
| VO               | `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/vo/UserInfoVO.java`                        | 类 + 字段 `@Schema`                                                                    |
| Result           | `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/Result.java`                  | 字段 `@Schema`(code / msg / data)                                                      |
| Result           | `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/ObjectResult.java`            | 字段 `@Schema`                                                                         |
| Result           | `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/ListResult.java`              | 字段 `@Schema`                                                                         |
| Yml              | `backend/java-admin/java-admin-api/src/main/resources/application-dev.yml`                                 | 补 `knife4j.setting` / `knife4j.enable` 之外的 `knife4j.openapi` title/version         |
| Yml              | `backend/java-admin/java-admin-api/src/main/resources/application-prod.yml`                                | 同上(可选,默认 prod 关闭)                                                              |
| 新增             | `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/config/OpenApiConfig.java`                 | 新增 Knife4j/SpringDoc 配置类(Bearer Token 鉴权 + 通用响应 + tag 分组顺序)             |

**不在本任务范围**:

- Service / Repository / Entity 层不加注解(数据模型已在 DTO/VO 暴露,Entity 直接 @Schema 会污染文档)
- 不新增端点;不改业务逻辑;不改现有 yml 鉴权开关
- 不写新测试(注解纯文档元数据,运行时无副作用)

## 注解选型(Q 决策)

| 选择                                                          | 原因                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`io.swagger.v3.oas.annotations.*`**                         | Knife4j 4.5 + `knife4j-openapi3-jakarta-spring-boot-starter` 默认走 OpenAPI 3,**禁止**再用 swagger v2 的 `@Api` / `@ApiOperation`          |
| **Jakarta 命名空间**                                          | Spring Boot 3.x;`jakarta.validation.constraints.*` 已用,annotation 保持一致                                                                |
| **不在 Entity 加注解**                                        | Entity 是数据库对象;VO/DTO 是 API 对象;混用会让 Knife4j 文档包含不必要的字段(如 `passwordHash`)                                            |
| **`Result<T>` 字段 `@Schema` 但不加类级 `@Schema(name=...)`** | 类上 `@Schema` 会让 Knife4j 把 `Result<T>` 作为独立 schema 注册,与 `ObjectResult`/`ListResult` 子类产生重复;只注解字段即可保留泛型展开能力 |

## 鉴权配置(必要的)

Sa-Token 默认走 `Authorization: Bearer <token>` 或 `satoken` header。本次:

- 在 `OpenApiConfig` 注册一个 `SecurityScheme`(HTTP Bearer)
- `/api/v1/auth/login` 不加 `@SecurityRequirement`(未登录)
- `/api/v1/auth/logout` 与 `/api/v1/auth/info` 加 `@SecurityRequirement(name = "bearerAuth")` 以便 Knife4j 调试页面带 token

## 验收标准

- [ ] **A1 编译通过**:在 backend/java-admin 根目录 `mvn -DskipTests compile` 退出码 0
- [ ] **A2 测试通过**:在 backend/java-admin 根目录 `mvn -pl java-admin-infra,java-admin-service,java-admin-api test`(已知现有测试)全部通过
- [ ] **A3 端点全覆盖**:`@RestController` / `@RestControllerAdvice` 类各加 `@Tag`;每个 public 方法都有 `@Operation`(summary 必填)
- [ ] **A4 请求体注解**:`AuthController.login` 的 `LoginRequest` 字段在文档里能看到 description / example
- [ ] **A5 响应体注解**:`LoginResponse` / `UserInfoVO` / `Result<T>` 字段都有 description
- [ ] **A6 异常响应**:每个 `@ExceptionHandler` 方法至少有一条 `@ApiResponse` 描述其返回的 HTTP 状态和 Result 形状
- [ ] **A7 鉴权文档**:`OpenApiConfig` 注册了 bearer security scheme;`logout` / `info` 端点显示锁图标
- [ ] **A8 启动验证**:`mvn -pl java-admin-api spring-boot:run` 起服务后 `GET /v3/api-docs` 返回的 JSON 包含 `tags: ["鉴权"]` 和 `components.schemas.LoginRequest`
- [ ] **A9 prod yml 不退化**:`application-prod.yml` 中 `knife4j.enable: false` 行为不变(注释或字段顺序调整不算退化)
- [ ] **A10 现有测试无回归**:`AuthServiceTest`、`NacosConfigTest`、`TraceIdFilterTest`、`GlobalExceptionHandlerTest`、`ResultFormatTest` 等仍然绿

## 风险与注意

1. **OpenAPI v3 注解必须导入 `io.swagger.v3.oas.annotations`**(不是 `io.swagger.annotations`)。knife4j 4.x 兼容 swagger v3 但**不兼容** v2。
2. **不要给 `Result` 加 `@Schema(name=...)`**;类级 schema 注解会让 SpringDoc 把 `Result` 注册成独立 schema,泛型 `T` 没法正确解析。
3. **`@Tag` 的 `name` 用英文短词**(`"鉴权"`、`"全局异常"`),description 写中文,Knife4j 中文模式下展示更友好。
4. **`@RestControllerAdvice` 的方法**在 SpringDoc 里默认**不会**自动出现在 `/v3/api-docs`;需要显式给方法加 `@Operation` + `@ApiResponse` 才能看到错误响应示例。
5. **`knife4j.setting.language`** 已在 dev 配 `zh_cn`,不要改。
6. **不要把 `springdoc.swagger-ui.path`** 等 swagger-ui 原生配置写进来(knife4j 走自己的 `/doc.html`),会污染配置。

## 关联产物

- `design.md` — 技术设计:注解清单 + OpenApiConfig 配置 + 错误响应复用
- `implement.md` — 执行清单(开发策略 + 有序步骤 + 验证命令 + 回滚点)
- `implement.jsonl` / `check.jsonl` — 子代理需要读取的 spec/research 清单
