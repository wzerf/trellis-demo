# java-admin 基础架构后端 — 执行计划 (implement.md)

> 与 `prd.md`、`design.md` 配合使用。本文件是**人类可读的执行计划**。
> `implement.jsonl` / `check.jsonl` 提供给子代理的 spec / research 上下文清单，不替代本文件。

---

## A. 开发策略（2026-06-14 review gate 通过）

- **A. 开发模式**：**当前会话内顺序完成**。代码由主会话按 Phase B.1 → B.8 顺序写，逐步 review。不调 `trellis-implement` subagent。
- **B. 测试策略**：**默认流程**（实现后写单测）。不为每个 public 方法前置 TDD；单测在 Phase B.7 集中写。
- **C. 可选 review gate**：**5 个 gate 全部 disabled**。`trellis-check` 固定作为基础质量门（不在可选 5 个之列）。
- **D. pre-development 架构指导**：**不启用**。不调 `trellis-improve-codebase-architecture` guidance。

### Review-gate contract: explicit-selection-v1

**Optional review gates status: configured**

**Enabled optional review gates**：

- （无）

**Disabled optional review gates**：

- `trellis-spec-review`
- `trellis-code-review`
- `trellis-code-architecture-review`
- `trellis-improve-codebase-architecture`（依赖 code-architecture-review）
- `trellis-merge-review`

> 理由：本次为新工程骨架，平台标准 `trellis-check` 已覆盖质量验证；不额外开 review gate。
> `trellis-check` 始终保留在本策略块之外，作为基础质量门。

---

## B. 执行清单（有序）

> 主会话按此顺序推进；jsonl 清单作为子代理上下文备用。

### Phase B.1 — Maven 工程骨架

1. 创建 `backend/java-admin/pom.xml`（packaging=pom，继承 SB 4 parent，4 个 module）
2. 创建 4 个子模块 `pom.xml`：
   - `common`：jar；只引 `lombok` + `jakarta.validation`
   - `service`：依赖 common + easy-query + mysql-connector-j
   - `infra`：依赖 service + common + sa-token + sa-token-redisson + redisson-spring-boot-starter + spring-boot-starter-aop + knife4j starter + lombok + flyway-core + flyway-mysql
   - `api`：依赖前三者 + spring-boot-starter-web + spring-boot-starter-test + spring-cloud-starter-alibaba-nacos-config
   - **不**引入限流相关依赖（无 Redisson RateLimiter API）
3. 锁版本（properties）：
   - `<spring-boot.version>4.0.3</spring-boot.version>`（或当前 GA）
   - `<java.version>17</java.version>`（编译目标；运行环境为 JDK 25）
   - `<easy-query.version>3.1.27</easy-query.version>`
   - `<sa-token.version>1.44.0</sa-token.version>`
   - `<redisson.version>3.36.0</redisson.version>`（或最新）
   - `<knife4j.version>4.5.0</knife4j.version>`（或最新兼容 SB4 的 Jakarta starter）
   - `<lombok.version>1.18.34</lombok.version>`
   - `<mysql.version>9.2.0</mysql.version>`
   - `<flyway.version>10.20.0</flyway.version>`（或与 SB 4 兼容的最新）
   - `<spring-cloud-alibaba.version>2025.1.0.0</spring-cloud-alibaba.version>`（BOM）
4. 父 pom `<dependencyManagement>` 引入 Spring Cloud Alibaba BOM：
   ```xml
   <dependency>
       <groupId>com.alibaba.cloud</groupId>
       <artifactId>spring-cloud-alibaba-dependencies</artifactId>
       <version>${spring-cloud-alibaba.version}</version>
       <type>pom</type>
       <scope>import</scope>
   </dependency>
   ```

### Phase B.2 — common 模块

- `common/result/Result.java`、ResultCode.java（**3 字段：code, msg, data**；不含 traceId）
- `common/exception/BizException.java`、`AuthException.java`
- `common/constant/SecurityConstants.java`、`RedisKeys.java`
- `common/util/TraceIdUtil.java`
- ~~`common/annotation/RateLimit.java`~~ — **已移除**

### Phase B.3 — service 模块

- `service/entity/SysUser.java`（`@EntityProxy`）
  - **id: Long**（MySQL `BIGINT UNSIGNED`，Long 范围足够；不取 `BigInteger` 复杂度）
  - username / password / nickname / status（`Integer`） / createTime / updateTime
- `service/repository/SysUserRepository.java`（构造注入 `EasyEntityQuery`）
- `service/user/AuthService.java`（login）
- `service/user/SysUserService.java`（findById、findByUsername）

### Phase B.4 — infra 模块

- `infra/config/EasyQueryConfig.java`：声明 `DataSource`（如果 starter 不自动装配）
- `infra/config/RedissonConfig.java`：`RedissonClient` 单例（YAML 注入）
- `infra/config/SaTokenConfig.java`：`SaTokenDao` bean（`SaTokenDaoForRedisson`）
- `infra/config/Knife4jConfig.java`：OpenAPI bean
- `infra/config/WebConfig.java`：注册 `SaInterceptor`、`CorsFilter`（开发期）
- `infra/security/SaTokenConfigure.java`：`SaServletFilter` bean（白名单 + 前置头）
- `infra/log/TraceIdFilter.java`：`OncePerRequestFilter`，写 MDC + 响应头 `X-Trace-Id`
- `infra/log/RequestLogAspect.java`：环绕 Controller
- `infra/log/LogbackConfig.java`（或在 `logback-spring.xml`）
- `infra/exception/GlobalExceptionHandler.java`：`@RestControllerAdvice`（不处理 `RateLimitException`，已移除）
- `infra/config/NacosConfig.java`：`@ConditionalOnProperty(name = "nacos.config.enabled", havingValue = "true")` 占位类；让 starter 在关闭时不装配
- `src/main/resources/logback-spring.xml`
- ~~`infra/ratelimit/RateLimitAspect.java`~~ — **本版本不实现限流，已移除**

### Phase B.5 — api 模块

- `api/Application.java`：`@SpringBootApplication`、`@EnableAspectJAutoProxy`
- `api/controller/AuthController.java`：`/api/v1/auth/login`、`/logout`、`/info`
- `api/dto/LoginRequest.java`（`@Valid`）
- `api/vo/LoginResponse.java`、`UserInfoVO.java`
- `src/main/resources/application.yml`、`application-dev.yml`、`application-prod.yml`

### Phase B.6 — Flyway 迁移

- `java-admin-api/src/main/resources/db/migration/V1__init_sys_user.sql`
  - 建表 `sys_user`，字段类型对齐 v5 部分约定（snake_case + BIGINT UNSIGNED）
  - 不含 `deleted_at` / `is_enabled` / 完整 7 字段审计
- `java-admin-api/src/main/resources/db/migration/V2__seed_admin_user.sql`
  - 插入 `admin` 用户，BCrypt 哈希 `admin123`（dev 用）
- `application-dev.yml`：`spring.flyway.locations: classpath:db/migration`
- `application-prod.yml`：`spring.flyway.locations: classpath:db/migration-prod`（迁移脚本目录不含 V2）
  - 或者保留 V2 但用 `${FLYWAY_SEED_ENABLED}` placeholder；dev=true，prod=false
- **删除** 之前 MVP 设计的 `backend/db/init.sql`（被 Flyway 替代）
- 移除 `spring.sql.init.*` 相关配置

### Phase B.7 — Docker Compose

- 创建 `backend/java-admin/deploy/docker-compose.yml`：
  - `mysql:8.4`：端口 **4336**（host）→ 3306（container），volume 持久化（`mysql_data`），healthcheck（`mysqladmin ping`），root 密码 / 数据库 / 用户由环境变量注入
  - `redis:7-alpine`：端口 **4379**（host）→ 6379（container），volume 持久化（`redis_data`），healthcheck（`redis-cli ping`）
  - `nacos/nacos-server:v2.4.3`：端口 **4848**（host HTTP）→ 8848（container），**5848**（host gRPC）→ 9848（container；Nacos 强约束 = HTTP+1000），volume 持久化（`nacos_data`），MODE=standalone，NACOS_AUTH_ENABLE=false（dev），healthcheck（`curl /nacos/`）
  - `adminer:latest`：端口 8081，**默认 profile=dev** 才启动（`profiles: [dev]`）
- 创建 `backend/java-admin/deploy/.env.example`：环境变量模板（MYSQL/REDIS/NACOS）
- 创建 `backend/java-admin/deploy/README.md`：起停命令、profile 说明、Nacos console URL

### Phase B.8 — 测试（与 B.3-B.5 同步推进；B.7 后补集成验证）

- `service/.../AuthServiceTest.java`：`@ExtendWith(MockitoExtension.class)`，mock Repository
- `infra/.../GlobalExceptionHandlerTest.java`：mock MVC
- `api/.../AuthControllerTest.java`：`@WebMvcTest` + `MockMvc`
- `infra/.../NacosConfigTest.java`：验证 `nacos.config.enabled=false` 时 `NacosConfigProperties` bean **不**被创建
- `infra/.../FlywayConfigTest.java`（轻量）：验证 V1 / V2 资源存在且 SQL 可解析
- `api/.../ResultFormatTest.java`：验证 `Result` JSON 序列化只含 `code/msg/data` 三个字段（**不**含 traceId）
- `deploy/.../docker-compose-validate.sh`：用 `docker compose config -q` 校验 compose 文件语法
- ~~`infra/.../RateLimitAspectTest.java`~~ — **已移除**

### Phase B.9 — 文档与 spec

- 更新 `.trellis/spec/backend/database-guidelines.md`：写入 easy-query 路径与版本约束（**已完成**）
- 更新 `.trellis/spec/backend/directory-structure.md`：写入本项目四模块结构（**已完成**）
- 更新 `.trellis/spec/backend/logging-guidelines.md`：写入 MDC traceId 规范（**已完成**）
- 更新 `.trellis/spec/backend/error-handling.md`：写入统一响应与异常体系（**已完成**）
- 更新 `.trellis/spec/backend/quality-guidelines.md`：写入 review 必看清单（**已完成**）
- 新增 `.trellis/spec/backend/infra-flyway.md`：Flyway 命名、profile 隔离、迁移规范（**已完成**）
- 新增 `.trellis/spec/backend/infra-docker-compose.md`：dev compose 编排规范（**已完成**）
- 新增 `.trellis/spec/backend/infra-nacos.md`：Nacos Config 可插拔、namespace/dataId 策略（**待写**）

---

## C. 验证命令（自检）

> 在所有 Phase B.x 完成后跑。

```bash
# C.1 校验
cd /Users/wshake/code/trellis-demo
mvn -f backend/java-admin/pom.xml -N validate

# C.2 编译
mvn -f backend/java-admin/pom.xml -DskipTests clean package

# C.3 测试
mvn -f backend/java-admin/pom.xml test

# C.4 启动 dev 依赖（docker compose）
cd backend/java-admin/deploy
docker compose --profile dev up -d
docker compose ps   # 四个服务都 healthy（mysql / redis / nacos / adminer）

# C.5 启动 java-admin（需本地 Redis+MySQL 准备好）
cd /Users/wshake/code/trellis-demo
mvn -f backend/java-admin/java-admin-api/pom.xml spring-boot:run \
    -Dspring-boot.run.profiles=dev

# C.6 验证 Flyway 已跑（看启动日志 "Migrating schema ... to version 1 - init sys_user"）
grep "Migrating schema" logs/spring.log   # 或 docker logs / 控制台

# C.7 验证端点
curl -X POST http://localhost:4080/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"admin123"}'

curl http://localhost:4080/api/v1/auth/info \
     -H "satoken: <token-from-previous>"

# C.8 ~~验证限流~~ — 本版本不实现

# C.9 验证 Nacos 关闭时不连 Nacos（默认行为）
NACOS_CONFIG_ENABLED=false mvn ... spring-boot:run
# 期望启动日志无 `NacosConfigProperties` 加载；只走本地 yml

# C.10 验证 Nacos 开启时拉取远程配置
# 1) Nacos console 创建 namespace=java-admin-dev，dataId=java-admin-dev.yaml，content=spring.datasource.url=...
# 2) 启动 java-admin 时设 NACOS_CONFIG_ENABLED=true
NACOS_CONFIG_ENABLED=true mvn ... spring-boot:run
# 期望启动日志含 `NacosConfigProperties initialized` + `Located property source`

# C.11 关闭 dev 依赖
cd backend/java-admin/deploy
docker compose --profile dev down -v

# C.12 端口占用检查（4000 段）
lsof -i :4080 -i :4081 -i :4336 -i :4379 -i :4848 -i :5848 2>&1
# 期望：未启动时全部空；启动后 java-admin=4080 / mysql=4336 / redis=4379 / nacos=4848,5848 / adminer=4081
```

### C.10 期望结果

- `mvn validate` ✅
- `mvn package` 产出 4 个 jar
- `mvn test` 0 failure
- `docker compose --profile dev up -d` 三个服务都 healthy
- 启动 java-admin 日志含 `Started Application in X.XXX seconds` + `Migrating schema ... to version 1` + `Successfully applied 2 migrations`
- 登录接口：错密码 401 + `code=2002`；正确密码 200 + 返回 token
- ~~限流：连发 5 次 ≥ 第 3 次返回 429 + `code=3001`~~ — **已移除**
- 响应体严格 3 字段：`{"code":0,"msg":"ok","data":{...}}`（**不**含 traceId）
- 响应头 `X-Trace-Id` 含 traceId（用于客户端对账）
- `doc.html` 可访问
- 关闭后无残留容器

---

## D. 回滚点

| 阶段             | 回滚动作                                |
| ---------------- | --------------------------------------- |
| B.1 后           | `rm -rf backend/java-admin/`            |
| B.2-B.6 任一阶段 | 回到该模块 `mvn clean` 即可，骨架可重做 |
| B.7 后           | `rm -rf backend/java-admin/deploy/`     |
| B.8 后           | 删除对应 `*Test.java`                   |
| B.9 后           | `git checkout .trellis/spec/` 还原 spec |

> 整体可重入：所有产物都是新文件，冲突面极小。

---

## E. 顺序约束

- B.1 → B.2 → B.3 → B.4 → B.5 顺序（依赖）
- B.6（Flyway）必须早于 C.6 启动验证
- B.7（Docker Compose）必须早于 C.4（启动依赖）
- B.8 测试可在 B.3-B.5 任意阶段并行写
- B.9 文档可在 B.2 起任何阶段增量写，但**最终定稿**必须在 C.3 之前

---

## F. 与 Trellis workflow 的衔接

- 当前 Phase 1: Plan 产物：prd.md / design.md / implement.md 完整
- 即将进入 Phase 2: Execute
- 实施顺序遵循 B.1 → B.9
- 完成后走 `trellis-check`（Phase 3.1）→ 修正 → `trellis-finish-work`（归档 + journal）

---

**编制日期**：2026-06-14
**最后更新**：2026-06-14（Q5-Q8 决策 + 策略块定稿）
**对应任务**：`.trellis/tasks/06-14-java-admin-backend/`
**目标完成时间窗**：本任务内一次完成（骨架类工作，不分阶段交付）
