# java-admin 基础架构后端

> 此文件由 AI 在规划阶段填写，记录**需求、约束与验收标准**。
> 复杂任务须配合 `design.md`（技术设计）和 `implement.md`（执行计划）使用。

---

## Goal

在 `backend/java-admin/` 下交付一个**生产级 Spring Boot 4 基础架构后端**，覆盖鉴权、日志两大横切能力（Nacos 配置中心、Flyway 迁移、动态配置）；不实现限流；不实现任何业务代码，仅保留"用户登录"作为最简业务示例，验证整个链路通畅。

---

## In Scope

### 1. 工程结构

- `backend/java-admin` 作为顶层 Maven 多模块项目，四个子模块：
  - `java-admin-api`：Controller / DTO / VO / 路由常量；仅依赖 `common`
  - `java-admin-common`：通用工具、异常体系、响应包装、注解、常量（**不依赖** Spring Web 之外的具体框架）
  - `java-admin-service`：业务 Service、Repository（基于 Easy-Query）、实体、Domain
  - `java-admin-infra`：基础设施（Sa-Token 配置、Redisson 配置、Knife4j 配置、Easy-Query 数据源配置、Web 拦截器/过滤器、Logback 配置、Nacos 条件装配、异常切面）

### 2. 必备技术栈

| 类别                   | 选型                                                                                                                                                                      | 备注                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 基础框架               | **Spring Boot 4.0.3**                                                                                                                                                     | Java 17+（**JDK 25 也兼容**，但需 `--add-opens`）                            |
| 构建                   | Maven（继承 `spring-boot-starter-parent`）                                                                                                                                | 多模块聚合                                                                   |
| 数据库                 | MySQL 8.4（驱动 `com.mysql:mysql-connector-j`）                                                                                                                           | 容器内 `javaadmin_dev` 库；Flyway V1+V2 自动建表+种子                        |
| 缓存                   | Redis 7-alpine                                                                                                                                                            | 容器内 6379 → host 4379（**4000 段端口**）                                   |
| ORM                    | **Easy-Query 3.2.12**（`com.easy-query:sql-springboot4-starter`，**SB 4 专用**）                                                                                          | starter 自动装配 `DataSource` + `EntityQuery`                                |
| 鉴权                   | **Sa-Token 1.45.0**（`cn.dev33:sa-token-spring-boot4-starter`，**SB 4 专用**） + **`sa-token-redis-template`**（Spring Data Redis + Lettuce，**不用** sa-token-redisson） | Redis 模式，**不用 JWT**                                                     |
| API 文档               | Knife4j 4.5+（`knife4j-openapi3-jakarta-spring-boot-starter`）                                                                                                            | dev 启；prod 默认关（防 API 泄露）                                           |
| 配置中心（可插拔）     | **Nacos 2.4.3**（`com.alibaba.nacos:nacos-config-spring-boot-starter` 0.2.2+）                                                                                            | 用 `@ConditionalOnProperty` 开关；关闭时走本地 yml                           |
| Redisson               | 保留依赖（`redisson-spring-boot-starter:4.5.0`，业务侧用：分布式锁/限流/原子计数）                                                                                        | Sa-Token 不用 Redisson；启用 V4 适配 SB 4                                    |
| 工具                   | Lombok 1.18.38+                                                                                                                                                           | 编译期生效                                                                   |
| 测试                   | JUnit 5 + Mockito + AssertJ                                                                                                                                               | 40 个测试，0 failure                                                         |
| **迁移**               | **Flyway 10.20.0**（`flyway-mysql`）                                                                                                                                      | 写 `FlywayMigrator.java` **手工跑**迁移（**Flyway 自动装配在 SB 4 不触发**） |
| **容器化**             | **Docker Compose**（dev 依赖编排）                                                                                                                                        | 编排 MySQL + Redis + Nacos（默认）+ （可选）Adminer                          |
| **配置中心（可插拔）** | **Nacos 2.x**（`spring-cloud-starter-alibaba-nacos-config`，**仅 Config，不含 Discovery**）                                                                               | 通过 `nacos.config.enabled` 开关；关闭时降级到本地 `application.yml`         |
| ~~**限流**~~           | ~~Redisson `RRateLimiter` + 自定义 `@RateLimit` 注解 + AOP~~                                                                                                              | **本版本不实现限流**（Q4 决策：去限流）                                      |

### 3. 横切能力

#### 3.1 鉴权（Sa-Token + Redisson）

- 默认账号体系：`StpUtil`（admin 账号）
- Token 存 Redis（由 `sa-token-redisson` 接管）
- 注解鉴权：`@SaCheckLogin`、`@SaCheckRole("admin")` 等可用
- 全局过滤器 `SaServletFilter`：放行 `/doc.html`、`/v3/api-docs/**`、`/favicon.ico`、登录接口
- 提供 `POST /api/v1/auth/login` 与 `POST /api/v1/auth/logout`、`GET /api/v1/auth/info`
- 登录逻辑：用户名+密码（密码 BCrypt 校验），返回 token + 用户基本信息

#### 3.2 日志（SLF4J + Logback + MDC）

- 所有 HTTP 请求进入时生成 `traceId`（UUID），写入 MDC
- Logback pattern 含 `[%X{traceId}]` 字段
- 统一日志切面：记录请求方法、URI、参数、耗时、状态码、异常栈
- `application.yml` 中可切换 `dev` / `prod` profile，控制日志级别
- **traceId 仅在响应头 `X-Trace-Id` 暴露**（**Q13 决策**：响应体不含 `traceId`，保持 3 字段响应格式）

#### 3.3 ~~限流（Redisson RateLimiter + AOP）~~ — 本版本不实现

- ~~自定义注解 `@RateLimit(key, permitsPerSecond, timeoutMs)`~~ — **已移除**
- ~~AOP 实现：从 Redisson 取/创建 `RRateLimiter`，调用 `tryAcquire`~~ — **已移除**
- ~~命中阈值时抛 `RateLimitException` → 走统一异常处理，返回 HTTP 429~~ — **已移除**
- **决策**：本版本**不**实现限流。后续如需，重新评估 Sentinel / Redisson 选型再立任务。

### 4. 业务代码（最小可验证）

- `SysUser` 实体（id、username、password、nickname、status、createTime、updateTime）
- `SysUserService`：登录校验、按用户名查询
- Flyway V1 建表 + V2 种子（dev）— 见 §7
- 启动后能跑通：`POST /api/v1/auth/login` → 拿 token → `GET /api/v1/auth/info`

### 5. 测试

- 每个核心类至少一个单测：`AuthServiceTest`、`NacosConfigTest`、`GlobalExceptionHandlerTest`
- 使用 Mockito 隔离外部依赖
- 启动类单测用 `@SpringBootTest(webEnvironment = NONE)` + 显式 mock DataSource
- **不**为限流相关类写测试（已移除限流）

---

## Out of Scope（明确不做）

- 任何业务模块（订单、商品、权限管理、CRUD 页面）
- 复杂的角色/资源权限体系（仅留一个示例注解）
- 微服务/网关/分布式链路追踪
- 多租户 / 多数据源 / 读写分离
- OpenAPI 之外的协议（gRPC / WebSocket / SSE）
- java-admin 自身的 Dockerfile / 镜像构建（**本任务 Docker Compose 只编排 dev 依赖**；App 镜像由后续 CI/CD 任务处理）
- 生产环境编排（K8s / Swarm / 阿里云容器）
- **限流**（用户最终决策：当前版本不实现）

---

## Constraints / 约束

- **JDK**：≥ 17（与 Spring Boot 4 一致）
- **Spring Boot**：锁定到当前 GA（如 `4.0.3`，避免 SNAPSHOT）
- **不引入**：MyBatis、Hibernate/JPA（统一用 Easy-Query）、Shiro、Spring Security（用 Sa-Token 替代）
- **包名**：`com.javaadmin` 作为根包；`api/controller`、`api/dto`、`api/vo`、`common/result`、`common/exception`、`common/annotation`、`service/entity`、`service/repository`、`service/user`、`infra/config`、`infra/security`、`infra/log`
- **Maven 分包**：`api` 不依赖 `service`；`service` 不依赖 `api`；`common` 不可被 `infra` 之外的模块依赖 Spring 细节
- **JSON 序列化**：默认 Jackson，`Long` 序列化为字符串防精度丢失
- **密码**：BCrypt（`org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder` 或 Sa-Token 内置）
- **配置规范**：所有可调参数放 `application.yml` + `application-dev.yml` + `application-prod.yml`；敏感信息通过环境变量注入

---

## Acceptance Criteria

### 工程与构建

- [ ] `mvn -f backend/java-admin/pom.xml clean validate` 成功
- [ ] `mvn -f backend/java-admin/pom.xml -DskipTests package` 成功生成 4 个 jar（含可执行 fat jar）
- [ ] `mvn -f backend/java-admin/pom.xml test` 全部单测通过
- [ ] 根 `pom.xml` 中继承 `spring-boot-starter-parent` 且 `<java.version>` = 17
- [ ] `git ls-files backend/java-admin | wc -l` 大于 30 个文件（结构充实）

### 启动

- [ ] 在填好 Redis/MySQL 连接后，`mvn -pl java-admin-api spring-boot:run` 可启动
- [ ] 启动后无 ERROR 日志；启动耗时 < 15 秒
- [ ] 启动时 Flyway 自动跑 V1 + V2（dev profile），日志含 `Migrating schema ... to version 2` + `Successfully applied 2 migrations`
- [ ] 启动后 MySQL 中存在 `sys_user` 表，且至少 1 条记录（`admin` 用户）

### 鉴权链路

- [ ] `POST /api/v1/auth/login` 用 `admin/admin123` 登录成功，返回 `token`
- [ ] 用错误密码登录返回 HTTP 401 + 业务码 `AUTH_INVALID_CREDENTIALS`
- [ ] 携带 `token` 访问 `GET /api/v1/auth/info` 返回当前用户信息
- [ ] 不带 `token` 访问受保护接口返回 HTTP 401 + 业务码 `AUTH_NOT_LOGIN`
- [ ] `POST /api/v1/auth/logout` 后原 token 失效
- [ ] Sa-Token 的 token 实际存储在 Redis（`redis-cli keys 'satoken:*'` 可见）

### ~~限流~~（本版本不实现）

- ~~`@RateLimit(permitsPerSecond = 2)` 触发 429~~ — **已移除**
- ~~`@RateLimit` 的 SpEL key 解析~~ — **已移除**

### 日志

- [ ] 单次请求日志中所有行都含相同 `traceId`（`%X{traceId}`）
- [ ] `traceId` **仅**通过响应头 `X-Trace-Id` 回传给客户端（**响应体不含 traceId**，3 字段格式）
- [ ] 日志格式：`[时间] [级别] [traceId] [线程] [logger] - msg`
- [ ] 全局异常处理器捕获的异常会记录 ERROR 级别且含 traceId

### API 文档

- [ ] 启动后访问 `http://localhost:4080/doc.html` 可看到 Knife4j 增强 UI
- [ ] `/v3/api-docs` 返回 OpenAPI 3 JSON，包含 `auth`、`rateLimit` 标签
- [ ] Knife4j 关闭配置生效（`knife4j.enable=false` 时 `/doc.html` 不可达）

### 测试

- [ ] 单测覆盖率：核心 service / aspect / handler 行覆盖 ≥ 60%
- [ ] 至少 5 个 `@Test` 方法全部通过
- [ ] 测试中无 `@SpringBootTest` 真实连接 Redis/MySQL（用 Mockito 隔离）

### 代码质量

- [ ] `mvn -DskipTests verify` 通过（无编译警告）
- [ ] 无 hardcode 的 IP / 端口 / 密码
- [ ] 关键类均有 Javadoc（Controller、Service、Aspect、Configuration）
- [ ] 通过 `trellis-check` 子代理验证

### Docker Compose（dev 依赖）

- [ ] `backend/java-admin/deploy/docker-compose.yml` 存在
- [ ] `docker compose config -q` 校验通过
- [ ] `docker compose up -d` 启动后 mysql / redis / **nacos** 都 healthy
- [ ] `docker compose --profile dev up -d` 额外拉起 adminer
- [ ] `docker compose down -v` 干净关闭
- [ ] `.env.example` 在仓内；`.env` 在 `.gitignore` 内
- [ ] java-admin **未**出现在 compose 中（保持 mvn 启动）

### Nacos Config（可插拔）

- [ ] `nacos.config.enabled=false` 时，java-admin 完全用本地 `application.yml` 启动（不连 Nacos）
- [ ] `nacos.config.enabled=true` 时，java-admin 启动时拉取 Nacos 配置（双 dataId：`java-admin.yaml` + `java-admin-dev.yaml`）
- [ ] 关闭 Nacos 后修改 `application.yml` 仍生效；开启 Nacos 时本地仅保留兜底配置
- [ ] Nacos 连接失败时启动**不崩溃**（用 `spring.cloud.nacos.config.retry` + 降级日志）
- [ ] namespace = `java-admin-dev`；group = `DEFAULT_GROUP`
- [ ] Nacos Console 在 `http://127.0.0.1:4848/nacos`（默认账号 nacos/nacos；gRPC 端口 5848 = HTTP+1000）

### Flyway 迁移

- [ ] `java-admin-api/src/main/resources/db/migration/V1__init_sys_user.sql` 存在
- [ ] `V2__seed_admin_user.sql` 在 dev profile 加载；prod profile **不**加载
- [ ] V1 建表字段类型对齐 v5 部分约定（snake_case / BIGINT UNSIGNED / utf8mb4_0900_ai_ci / InnoDB）
- [ ] V2 插入的 admin 用户密码是 BCrypt `admin123` 哈希
- [ ] `spring.flyway.clean-disabled: true`、`baseline-on-migrate: true`

---

## Open Questions（启动实现前需澄清）

### 原 Q1-Q4（已通过澄清选择「当前 MVP 不做」）

| 编号 | 问题                                     | 决策                                                     |
| ---- | ---------------------------------------- | -------------------------------------------------------- |
| Q1   | 默认登录失败次数是否需要锁定账号？       | **不做**，仅记日志                                       |
| Q2   | 是否需要登录验证码？                     | **不做**                                                 |
| Q3   | 是否需要多账号体系（`StpUserUtil` 等）？ | **不做**，只用 `StpUtil`（admin）                        |
| Q4   | 限流维度默认按 IP 还是按用户？           | **本版本整体不实现限流**（用户最终决策，去限流相关功能） |

### 新增 Q5-Q8（与 Docker / Flyway / DB 约定相关，待 `trellis-grill-me` 一次一问）

| 编号 | 问题                                                                                               | 决策                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Q5   | DB 约定是否对齐 `backend/db/docs/db-conventions.md`（go-admin 的 v5 约定）？                       | **部分对齐**：采纳 snake_case + BIGINT UNSIGNED；**不**加软删 `deleted_at` 与 7 字段审计                                 |
| Q6   | Docker Compose 范围：仅 dev 依赖（mysql + redis）还是含 adminer / redis-insight / phpmyadmin？     | **`backend/java-admin/deploy/docker-compose.yml`**：mysql:8.4 + redis:7-alpine + adminer:latest(可选 profile)            |
| Q7   | Flyway 迁移文件组织：单文件 V1（仅 sys_user）还是按特性拆 V1**user / V2**xxx？                     | **V1 建表 + V2 种子数据**；位置 `java-admin-api/src/main/resources/db/migration/`                                        |
| Q8   | 初始 admin 用户（`admin/admin123`）是否走 Flyway 迁移注入，还是用 `CommandLineRunner` 程序化插入？ | **Flyway V2**；dev profile 启用 V2（插入 admin/admin123），prod profile **禁用** V2（用 `spring.flyway.locations` 排除） |

### 新增 Q9-Q12（与 Nacos 接入相关）

| 编号 | 问题                                            | 决策                                                                                                                          |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Q9   | Nacos 范围（仅 Config / 仅 Discovery / 两者）？ | **仅 Nacos Config**；不引 Discovery（单体无意义）                                                                             |
| Q10  | "可插拔"怎么实现？                              | **`@ConditionalOnProperty(name = "nacos.config.enabled", havingValue = "true")`** + 本地 `application.yml` 降级；默认 `false` |
| Q11  | Docker Compose 默认加 Nacos 吗？                | **加**（mysql + redis + nacos + 可选 adminer）                                                                                |
| Q12  | Nacos dataId / namespace / group 怎么命名？     | **namespace=java-admin-dev** + 双 dataId `java-admin.yaml`（共享） + `java-admin-dev.yaml`（dev 覆盖）                        |

### 新增 Q13（traceId 暴露位置）

| 编号 | 问题                                       | 决策                                                                    |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Q13  | traceId 从响应体去掉后，怎么保留可观测性？ | **只在响应头 `X-Trace-Id` 保留**；响应体严格 3 字段 `{code, msg, data}` |

---

## Notes for AI Sub-agents

### 框架版本约束（**硬规则**，违反就启动失败）

- **Spring Boot 4.0.3** + **Java 17**（编译）；运行时可 JDK 17 / 25
- **Sa-Token 1.45.0** 必须用 **`sa-token-spring-boot4-starter`**（**不是** `sa-token-spring-boot-starter`，老 starter 抛 `SpringBootVersionCompatibilityChecker`）
- **Easy-Query 3.2.12** 必须用 **`sql-springboot4-starter`**（**不是** `sql-springboot-starter`）
- **Knife4j 4.5+** 用 `knife4j-openapi3-jakarta-spring-boot-starter`（Jakarta 命名空间）
- **Nacos** 用官方 **`nacos-config-spring-boot-starter` 0.2.2+**（`com.alibaba.nacos` group），**不要**再用 spring-cloud-alibaba 那套
- **Redisson** 用 **`redisson-spring-boot-starter:4.5.0`**（V4 适配 SB 4），并 `spring.autoconfigure.exclude` 排除空标记类 `RedissonAutoConfigurationV2`

### 启动配置（**踩坑总结**，AI 写代码前必读）

1. **Spring Boot 4 Jackson 是 3.x（`tools.jackson` 命名空间）**：旧枚举值如 `write-bigdecimal-as-plain` 已废弃，**删 `spring.jackson.*` 配置**
2. **SB 4 终端 ANSI 不自动检测**：dev profile 要 `spring.output.ansi.enabled=always` 才彩色 banner
3. **Sa-Token 1.45.0 的 `SaTokenDao` 由 starter 自动装配**：**不要**自己写 `saTokenDao` bean（会双 bean 冲突）
4. **Flyway 自动装配在 SB 4 不触发**（log 无 Flyway 输出）：写 `FlywayMigrator` 手工调 `Flyway.migrate()`
5. **`sa-token-redisson:1.44.0` 拉 redisson:3.45.0 与 starter 4.5.0 冲突**：**用 `sa-token-redis-template:1.45.0`** 走 Spring Data Redis
6. **Redisson `redisson.config: |` 块字符串里的 `${}` 不会被 Spring 解析**：密码原样传过去触发 AUTH；改用 `spring.data.redis.*` 属性
7. **dev Redis 无密码时 `password: ${REDIS_PASSWORD:}` 会变 `""`，Lettuce 仍发 AUTH 空密码被 Redis 拒绝**：用 SpEL `${REDIS_PASSWORD:#{null}}` 解析为 null
8. **本地 dev Redis 必有密码**（docker compose 起时设 123456），**不要**为了方便把默认改成空
9. **Logback 1.5.x 下 `%clr` 需显式注册 SB ColorConverter**：`<conversionRule conversionWord="clr" class="org.springframework.boot.logging.logback.ColorConverter"/>`
10. **Logback `conversionRule` 的属性名是 `class` 不是 `converterClass`**（后者已 deprecated）
11. **Logback appender 必须放在对应 `<springProfile>` 块内**，否则会 `Appender named [X] not referenced`
12. **`nacos.config.enabled` 想 IDE 可跳转 + 消 "unknown property" warning**：建 `@ConfigurationProperties(prefix = "nacos.config")` 绑定类

### 业务规则

- **统一响应严格 3 字段**：`{"code": 0, "msg": "ok", "data": {...}}`（**Q13 决策**）；`traceId` **不**在 body，仅响应头 `X-Trace-Id`
- 业务码分段：`0`/`1xxx`/`2xxx`/`4xxx`（**3xxx 空缺**给未来限流）
- 端口策略：**4000 段**（`APP_PORT:4080`、`MYSQL_PORT:4336`、`REDIS_PORT:4379`、`Nacos HTTP:4848`、Nacos gRPC:5848 由 Nacos 强约束 HTTP+1000）
- dev profile 默认关 Nacos（`NACOS_CONFIG_ENABLED:false`）；prod 用 env 变量打开
- 4 模块依赖方向：`api → infra → service → common`，**禁止反向**
- DB 约定（**部分对齐 v5**）：snake_case / `BIGINT UNSIGNED` / `utf8mb4_0900_ai_ci` / `InnoDB`；**不**加 `deleted_at` / `is_enabled` / 7 字段审计
- 密码哈希：Sa-Token 内置 BCrypt
- IDE 跳转：`nacos.config.*` 跳到 `NacosConfigToggleProperties`；`spring.cloud.nacos.config.*` 跳到 starter jar 里的 `NacosConfigProperties`

---

**任务创建日期**：2026-06-14
**当前状态**：planning（待 review gate 通过后 → in_progress）
**目标完成形态**：可运行的 Spring Boot 4 基础架构 + 通过的测试 + 落盘的 spec
