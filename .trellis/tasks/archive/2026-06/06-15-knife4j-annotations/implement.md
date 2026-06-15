# Implement — 为 java-admin 补全 knife4j 注解

> 与 prd.md / design.md 配套。本文件是**执行清单**(有序步骤、review 闸门、验证命令、回滚点)。
> 技术设计在 design.md,需求在 prd.md。

---

## 0. 准备

- 确认 git 状态干净(`git status`)
- 确认 base branch 是 `master`(task.json `base_branch: master`)
- 拉取 spec 索引:`python3 .trellis/scripts/get_context.py --mode packages` 备用(本次不强制)
- JDK 17,无需特殊环境

---

## 1. 开发策略

**直改模式**(无 TDD):

- 注解是纯文档元数据,运行时不改 HTTP 行为;无业务逻辑可"先写测试再实现"
- 现有 `GlobalExceptionHandlerTest` / `AuthServiceTest` 已覆盖行为,本任务只验证不回归
- 增量小(改 6 文件 + 增 1 文件),不需要拆分子任务

**顺序**:公共层 → API 层 → INFRA 层 → 配置 → 验证。原因:

1. `common.result` 是上游,被 api/infra 引用 → 先加字段注解,保证下游编译时能找到
2. api 模块的 DTO/VO/Controller 是文档主体
3. infra 模块的 `@RestControllerAdvice` 依赖 springdoc 自动扫描
4. 配置类最后加,避免编译期 Bean 顺序问题

---

## 2. 有序步骤

### Step 1: Result 公共层注解(改 3 文件)

按顺序改:

1. `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/Result.java`
   - 顶部 import:`import io.swagger.v3.oas.annotations.media.Schema;`
   - 三个字段加 `@Schema(description = "...", example = "...")`(见 design.md §5)
2. `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/ObjectResult.java`
   - 字段加 `@Schema`
3. `backend/java-admin/java-admin-common/src/main/java/com/wshake/common/result/ListResult.java`
   - 字段加 `@Schema`

**验证**:`mvn -DskipTests -pl backend/java-admin/java-admin-common -am compile` 通过。

### Step 2: api 模块 DTO/VO 注解(改 3 文件)

按顺序改:

1. `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/dto/LoginRequest.java`
   - 类级 `@Schema(description = "账号密码登录请求")`
   - 字段 `username` / `password` 加 `@Schema`(见 design.md §4.1)
2. `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/vo/LoginResponse.java`
   - 类级 `@Schema(description = "登录成功响应")`
   - 4 个字段加 `@Schema`(见 design.md §4.2)
3. `backend/java-admin/java-admin-api/src/main/java/com/wshake/api/vo/UserInfoVO.java`
   - 类级 `@Schema(description = "当前登录用户信息")`
   - 5 个字段加 `@Schema`(见 design.md §4.3)

**验证**:`mvn -DskipTests -pl backend/java-admin/java-admin-api -am compile` 通过。

### Step 3: AuthController 注解(改 1 文件)

文件:`backend/java-admin/java-admin-api/src/main/java/com/wshake/api/controller/AuthController.java`

- 类级 `@Tag(name = "鉴权", description = "登录、登出、当前用户信息")`
- `login()`:
  - `@Operation(summary = "账号密码登录", description = "...")`
  - 入参 `@Parameter(description = "...", required = true) LoginRequest req`
  - `@ApiResponses`:
    - `200`:content = `@Content(schema = @Schema(implementation = Result.class))` — 让 SpringDoc 用 `Result<LoginResponse>` 泛型展开
    - `400`:PARAM_INVALID
    - `401`:AUTH_INVALID_CREDENTIALS
  - **不加** `@SecurityRequirement`
- `logout()`:
  - `@Operation(summary = "登出")`
  - `@SecurityRequirement(name = "bearerAuth")`
  - `@ApiResponses`:200 / 401
- `info()`:
  - `@Operation(summary = "当前登录用户信息")`
  - `@SecurityRequirement(name = "bearerAuth")`
  - `@ApiResponses`:200(Result<UserInfoVO>) / 401

**验证**:`mvn -DskipTests -pl backend/java-admin/java-admin-api -am compile` 通过。

### Step 4: GlobalExceptionHandler 注解(改 1 文件)

文件:`backend/java-admin/java-admin-infra/src/main/java/com/wshake/infra/exception/GlobalExceptionHandler.java`

- 类级 `@Tag(name = "全局异常", description = "...")`
- 每个 `@ExceptionHandler` 方法加 `@Operation(summary = "...")` + `@ApiResponse(responseCode = "...", description = "...", content = @Content(schema = @Schema(implementation = Result.class)))`(见 design.md §3.2 表格)
- 顶部 import 新增:`io.swagger.v3.oas.annotations.*` 几个类

**验证**:`mvn -DskipTests -pl backend/java-admin/java-admin-infra -am compile` 通过。

### Step 5: 新增 OpenApiConfig(增 1 文件)

新建:`backend/java-admin/java-admin-api/src/main/java/com/wshake/api/config/OpenApiConfig.java`

内容见 design.md §6.1。**注意**:

- 包路径:`com.wshake.api.config`(已有目录约定)
- `@Configuration` 即可,**不**加 `@ConditionalOnProperty`(dev/prod 都启用 OpenAPI 元数据,prod 仅 knife4j 文档页关闭,API 描述保留——更便于内部联调)
- 实际效果:prod 启服务后 `GET /v3/api-docs` 仍返回 JSON,但 `/doc.html` 显示为空(dev 的 `knife4j.enable=true` 才显示)

**验证**:`mvn -DskipTests -pl backend/java-admin/java-admin-api -am compile` 通过。

### Step 6: yml 不动(显式决策)

`application-dev.yml` / `application-prod.yml` **不改**:

- dev 已配 `knife4j.enable: true` + `language: zh_cn`
- prod 已配 `knife4j.enable: ${KNIFE4J_ENABLE:false}`
- title/version/contact 走 `OpenApiConfig` Java bean,yml 不重复

如果 Step 7 验证时发现 Knife4j 4.5 对 yml vs Java bean 有冲突,再回到这里用 yml 方式(届时记录在 design.md 决策表)。

### Step 7: 全量验证

```bash
cd /Users/wshake/code/trellis-demo
mvn -DskipTests -pl backend/java-admin -am compile
```

预期:退出 0,无 warning。

```bash
mvn -pl backend/java-admin/java-admin-infra,java-admin-service,java-admin-api test
```

预期:全部测试通过(尤其 `GlobalExceptionHandlerTest` / `AuthServiceTest` / `ResultFormatTest`)。

### Step 8(可选):运行时验证

仅当开发机有 Java + Maven 且本地能起 MySQL/Redis/Nacos 时:

```bash
mvn -pl backend/java-admin/java-admin-api spring-boot:run -Dspring-boot.run.profiles=dev &
sleep 30
curl -s http://localhost:8080/v3/api-docs | jq '.tags[].name'
# 期望输出含 "鉴权" "全局异常"
curl -s http://localhost:8080/v3/api-docs | jq '.components.securitySchemes | keys'
# 期望输出含 "bearerAuth"
curl -s http://localhost:8080/v3/api-docs | jq '.components.schemas | keys'
# 期望输出含 "LoginRequest" "LoginResponse" "UserInfoVO" "Result"
```

如无本地 dev 环境,跳过本步;Step 7 的 compile + test 已经覆盖编译期正确性。

---

## 3. Review 闸门

每个 Step 完成后必须自检(对照 design.md 表格/清单):

- [ ] Step 1:`Result` / `ObjectResult` / `ListResult` 字段都有 `@Schema`,且**类无** `@Schema` 注解
- [ ] Step 2:DTO/VO 类级有 `@Schema(description=...)`,字段都有 `@Schema` + `example`(能给的)
- [ ] Step 3:AuthController 类有 `@Tag`;3 个方法都有 `@Operation`;`logout` / `info` 有 `@SecurityRequirement(name="bearerAuth")`
- [ ] Step 4:GlobalExceptionHandler 类有 `@Tag`;8 个 handler 方法都有 `@Operation` 和 `@ApiResponse`
- [ ] Step 5:OpenApiConfig 有 `@Configuration` + `@Bean OpenAPI` + title/version/contact/bearerAuth
- [ ] Step 6:yml diff 为空
- [ ] Step 7:`mvn compile` 通过;`mvn test` 全绿

---

## 4. 回滚点

| 触发条件                                    | 回滚动作                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Step 7 compile 失败(注解包错、import 拼写)  | `git checkout HEAD -- <file>` 单文件回退                                                         |
| Step 7 test 失败(注解影响运行时序列化)      | 先看 diff 排查,**禁止** `git reset --hard`                                                       |
| Step 8 Knife4j 文档异常(如 schema 解析失败) | 检查 `Result` 是否漏了 `@Schema` 字段注解,或 `@ApiResponse.content` 漏 schema                    |
| prod yml 被意外修改                         | `git checkout HEAD -- backend/java-admin/java-admin-api/src/main/resources/application-prod.yml` |

**严禁**:`git reset --hard` / `git push --force`(workflow 明令)。

---

## 5. 任务结束清单(Phase 3)

- [ ] 所有 A1–A10 验收项勾上(见 prd.md)
- [ ] `git add` + 提交(等用户指令才 commit,**不要主动 push**)
- [ ] 更新 task.json 的 `commit` / `pr_url`(如有)
- [ ] 走 `python3 ./.trellis/scripts/task.py finish` 归档
- [ ] 在 `.trellis/spec/backend/quality-guidelines.md`(或新建 `api-annotation-guidelines.md`)落盘"Knife4j 注解约定"

---

## 6. 子代理分派预案(本次不实际分派)

如果 Step 7 验证时发现某些字段注解需要补查(如 `@Schema.allowableValues` 写法、knife4j 4.5 某个注解签名),会用 `trellis-research` 查文档;jsonl 已经登记了 spec 入口。
