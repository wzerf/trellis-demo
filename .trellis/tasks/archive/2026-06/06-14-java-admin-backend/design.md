# java-admin 基础架构后端 — 技术设计 (design.md)

> 与 `prd.md` 配合使用。本文件记录**技术设计**：模块边界、依赖图、数据契约、权衡、兼容性、回滚点。
> 实现细节走 `implement.md`，质量验证走 `trellis-check`。

---

## 1. 模块依赖图（Maven Reactor）

```
backend/java-admin/                          (packaging = pom)
├── java-admin-common/                       (jar, 基础库)
│      ├── 无 Spring Web 依赖；只依赖 spring-context + jakarta.validation
│      └── 提供：Result/Page/异常体系/注解/常量/工具
│
├── java-admin-service/                      (jar, 业务)
│      ├── 依赖：common
│      ├── 包含：SysUser entity、Repository（Easy-Query 风格）、Service
│      └── 不依赖 api / infra
│
├── java-admin-infra/                        (jar, 基础设施)
│      ├── 依赖：common、service
│      ├── 包含：Sa-Token 配置、Redisson 配置、Knife4j 配置
│      │         Easy-Query 数据源配置、Web 拦截器/过滤器、Logback 配置
│      │         Nacos 条件装配、全局异常切面、MDC 过滤器
│      └── 不依赖 api
│
└── java-admin-api/                          (jar → spring-boot-maven-plugin 打包可执行 jar)
       ├── 依赖：common、service、infra
       ├── 包含：Controller、DTO、VO、Application 主类
       └── 是唯一带 `@SpringBootApplication` 的模块
```

**依赖方向**：`api → infra → service → common`。**禁止反向依赖**（api 不能被 service / infra 引用；service 不能被 api 引用）。

---

## 2. 包结构

根包：`com.javaadmin`

```
com.javaadmin
├── api
│   ├── controller       # AuthController、UserController（仅示例）
│   ├── dto              # LoginRequest
│   ├── vo               # LoginResponse、UserInfoVO
│   └── Application.java # @SpringBootApplication
│
├── common
│   ├── result           # Result<T>、ResultCode
│   ├── exception        # BizException、AuthException
│   ├── constant         # SecurityConstants、RedisKeys
│   └── util             # TraceIdUtil、JsonUtil
│
├── service
│   ├── entity           # SysUser（@EntityProxy）
│   ├── repository       # SysUserRepository（基于 Easy-Query）
│   ├── user             # SysUserService、AuthService
│   └── dto              # 内部领域 DTO
│
└── infra
    ├── config           # SaTokenConfig、RedissonConfig、EasyQueryConfig、Knife4jConfig、WebConfig、NacosConfig
    ├── security         # SaTokenConfigure（SaServletFilter 注册）
    ├── log              # TraceIdFilter、RequestLogAspect、logback-spring.xml
    └── exception        # GlobalExceptionHandler
```

> ~~`common.annotation` / `infra.ratelimit`~~：本版本不实现限流，**已移除**。
> ~~`@RateLimit` / `RateLimitAspect` / `RateLimitException`~~：**已移除**。

---

## 3. 核心契约

### 3.1 统一响应 `Result<T>`

```json
{
  "code": 0,
  "msg": "ok",
  "data": { ... }
}
```

> **Q13 决策**：响应体严格 3 字段 `{code, msg, data}`。`traceId` **不**在 body 中，仅通过响应头 `X-Trace-Id` 暴露。
> 字段命名：`message` → `msg`（更紧凑，便于前端字段映射）。

业务码规则：

- `0`：成功
- `1xxx`：通用（参数错误、远程调用失败等）
- `2xxx`：鉴权（`AUTH_NOT_LOGIN=2001`、`AUTH_INVALID_CREDENTIALS=2002`、`AUTH_TOKEN_EXPIRED=2003`）
- ~~`3xxx`：限流（`RATE_LIMIT_EXCEEDED=3001`）~~ — **本版本移除**
- `4xxx`：业务（保留）

### 3.2 异常体系

```
RuntimeException
├── BizException(code, msg)              # 业务异常基类
└── AuthException(AuthErrorCode)         # 鉴权异常（包装 Sa-Token 异常）
```

> ~~`RateLimitException`~~：本版本不实现限流，**已移除**。

`GlobalExceptionHandler`（`@RestControllerAdvice`）捕获以上两类 + `SaTokenException` + `MethodArgumentNotValidException` + `Exception`，统一转 `Result`。

### 3.3 鉴权契约（Sa-Token）

- Token 名：`satoken`
- Token 风格：`uuid`
- 超时：2592000s（30 天）
- 多端登录：允许（`is-concurrent: true`）
- 存储后端：`sa-token-redisson`（接管 `SaTokenDao`）
- 登录：`StpUtil.login(userId)` 写入 session；登出：`StpUtil.logout()`
- 密码校验：BCrypt（`StpUtil.hasRole("admin")` 校验角色）

### 3.5 日志契约

- 入口：`TraceIdFilter`（`OncePerRequestFilter`，`@Order(Ordered.HIGHEST_PRECEDENCE)`）
  - 从 header `X-Trace-Id` 读取，没有则生成 UUID
  - 写入 `MDC.put("traceId", traceId)` 与响应头
  - 请求结束后 `MDC.clear()`
- 切面：`RequestLogAspect` 环绕 Controller，记录 method/uri/params/耗时/状态
- Logback pattern：
  ```
  %d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%X{traceId}] [%thread] %logger{36} - %msg%n
  ```

---

## 4. 关键数据流

### 4.1 登录

```
AuthController#login(LoginRequest)
  └─ AuthService#login(username, password)
       ├─ SysUserRepository#findByUsername → SysUser（Easy-Query）
       ├─ BCryptPasswordEncoder#matches(password, user.password)
       ├─ StpUtil.login(user.id)  // Sa-Token 写 Redis
       └─ 返回 LoginResponse{token, userId, username, nickname}
```

### 4.2 受保护请求

```
HTTP Request
  └─ TraceIdFilter                # 写 MDC + 响应头 X-Trace-Id
       └─ SaServletFilter         # 放行白名单 + 鉴权（sa-token-redisson 读 Redis）
            └─ DispatcherServlet
                 └─ Controller#method
                      └─ @SaCheckLogin / @SaCheckRole   # Sa-Token 注解
                           └─ AuthService / UserService
```

> ~~`RateLimitAspect`~~：本版本不实现限流，**已移除**。

---

## 5. Easy-Query 接入

- 依赖：`com.easy-query:sql-springboot4-starter:3.1.27+` + `com.easy-query:sql-processor:同版本`（APT，编译期）
- 实体示例：
  ```java
  @Data
  @Table("sys_user")
  @EntityProxy
  public class SysUser implements ProxyEntityAvailable<SysUser, SysUserProxy> {
      @Column(primaryKey = true)
      private Long id;
      private String username;
      private String password;
      private String nickname;
      private Integer status;
      private LocalDateTime createTime;
      private LocalDateTime updateTime;
  }
  ```
- Repository（基于 `EasyEntityQuery`）：
  ```java
  @Component
  public class SysUserRepository {
      private final EasyEntityQuery easyEntityQuery;
      public SysUserRepository(EasyEntityQuery eq) { this.easyEntityQuery = eq; }
      public SysUser findByUsername(String username) {
          return easyEntityQuery.queryable(SysUser.class)
                  .where(u -> u.username().eq(username))
                  .firstOrNull();
      }
  }
  ```
- `application.yml`：
  ```yaml
  easy-query:
    enable: true
    database: mysql
    name-conversion: underlined
    defaultDataSourceMergePoolSize: 16
  ```

---

## 6. 配置分层

```
backend/java-admin/java-admin-api/src/main/resources/
├── application.yml                # 基础（端口、profile、Sa-Token、easy-query）
├── application-dev.yml            # 本地（127.0.0.1, db=javaadmin_dev，启 Flyway V1+V2）
├── application-prod.yml           # 线上（环境变量注入，Flyway 仅 V1）
├── logback-spring.xml             # pattern + 文件 appender
└── db/migration/
    ├── V1__init_sys_user.sql
    └── V2__seed_admin_user.sql    # 仅 dev 加载
```

环境变量约定（prod profile 读取）：

- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DB`、`MYSQL_USER`、`MYSQL_PASSWORD`
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`
- `APP_PORT`（默认 4080）

---

## 7. 数据库初始化（Flyway）

**Q7 决策**：Flyway 替换原 `spring.sql.init` 方案。

- 依赖：`flyway-core` + `flyway-mysql`（api 模块引入；service / infra 不直接依赖 Flyway）
- 迁移文件位置：`backend/java-admin/java-admin-api/src/main/resources/db/migration/`
- 命名：
  - `V1__init_sys_user.sql`：建 `sys_user` 表
  - `V2__seed_admin_user.sql`：插入默认 admin 用户（仅 dev profile 加载）
- 配置：
  ```yaml
  spring:
    flyway:
      enabled: true
      baseline-on-migrate: true
      baseline-version: 0
      locations: classpath:db/migration
  ```
- dev / prod 隔离（**Q8 决策**）：
  - dev profile：`locations: classpath:db/migration`（含 V1 + V2）
  - prod profile：`locations: classpath:db/migration-prod`（仅 V1；V2 物理隔离）
  - 或单一目录 + `${FLYWAY_SEED_ENABLED}` placeholder 控制 V2 是否执行

### V1 表结构（Q5 决策：部分对齐 v5 约定）

```sql
-- V1__init_sys_user.sql
CREATE TABLE IF NOT EXISTS sys_user (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,   -- v5 对齐
    username    VARCHAR(64)      NOT NULL DEFAULT '',
    password    VARCHAR(255)     NOT NULL DEFAULT '',       -- BCrypt 哈希约 60 字符，留 255
    nickname    VARCHAR(64)      NOT NULL DEFAULT '',
    status      TINYINT          NOT NULL DEFAULT 1,        -- v5 不引入 is_enabled；MVP 用 status
    create_time DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_sys_user_username (username)            -- v5 对齐
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**未引入**的 v5 字段（本次 MVP 不加）：`remark` / `is_enabled` / `deleted_at` / `created_by` / `updated_by`。
**采纳**的 v5 约定：snake*case 列名 / `BIGINT UNSIGNED` 主键 / `uniq*<table>\_<col>`唯一索引 /`utf8mb4_0900_ai_ci`/`InnoDB`/ 显式`IF NOT EXISTS`。

### V2 种子数据（dev only）

```sql
-- V2__seed_admin_user.sql
-- 默认 admin / admin123，BCrypt 哈希
INSERT IGNORE INTO sys_user (username, password, nickname, status)
VALUES ('admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', 'Administrator', 1);
```

> 哈希是 `admin123` 的标准 BCrypt(10) 输出；启动后可用 `admin/admin123` 登录。

---

## 8. 容器化（Docker Compose，dev only）

**Q6 + Q11 决策**：`backend/java-admin/deploy/docker-compose.yml`，编排 4 个服务（**java-admin 自身不编排进 compose**，dev 用 `mvn spring-boot:run` 跑）。

### 8.1 服务清单

| 服务      | 镜像                        | 端口                              | 持久化                      | Healthcheck                                      | Profile |
| --------- | --------------------------- | --------------------------------- | --------------------------- | ------------------------------------------------ | ------- |
| `mysql`   | `mysql:8.4`                 | **4336**                          | `mysql_data` (named volume) | `mysqladmin ping -uroot -p$$MYSQL_ROOT_PASSWORD` | 默认    |
| `redis`   | `redis:7-alpine`            | **4379**                          | `redis_data` (named volume) | `redis-cli ping`                                 | 默认    |
| `nacos`   | `nacos/nacos-server:v2.4.3` | **4848** (HTTP) / **5848** (gRPC) | `nacos_data` (named volume) | `curl http://localhost:8848/nacos/`              | 默认    |
| `adminer` | `adminer:latest`            | **4081**                          | —                           | `wget -q --spider http://localhost:8080/`        | `dev`   |

### 8.2 Nacos 容器配置要点

- 镜像：`nacos/nacos-server:v2.4.3`（锁版本）
- 端口：**4848**（HTTP）+ **5848**（gRPC，2.x 强约束 = HTTP+1000；必须在 5xxx）
- 启动模式：`MODE=standalone`（dev 单节点；生产用 cluster）
- 鉴权：dev 默认关（`NACOS_AUTH_ENABLE=false`），prod 必须开
- 内存：`JVM_XMS=512m JVM_XMX=512m JVM_XMN=256m`
- 持久化：MySQL 外置模式（**dev 用内置 Derby**：`SPRING_DATASOURCE_PLATFORM=derby`）；prod 必须改 MySQL

### 8.3 网络

- 单一自定义网络 `java-admin-net`（bridge）
- 服务间通过服务名互访：`mysql:3306`、`redis:6379`、`nacos:8848`（容器内部端口仍是默认；host 端是 4336/4379/4848）
- java-admin 在 host 跑，与 compose 网络通过 `host.docker.internal` 或 `host_network` 互通
  - **推荐**：java-admin 跑在 host，用 `127.0.0.1` 连 MySQL/Redis/Nacos，compose 端口暴露到 host

### 8.4 文件结构

```
backend/java-admin/deploy/
├── docker-compose.yml
├── .env.example        # 环境变量模板（含 NACOS 鉴权开关等）
└── README.md           # 起停命令、profile 说明、Nacos console URL
```

### 8.5 关键命令

```bash
# 起 mysql + redis + nacos
cd backend/java-admin/deploy
docker compose up -d

# 起全部（含 adminer）
docker compose --profile dev up -d

# 关闭（保留 volume）
docker compose down

# 关闭（清 volume，慎用）
docker compose down -v
```

### 8.6 java-admin 连 dev 依赖

`application-dev.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:4336/javaadmin_dev?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8
    username: ${MYSQL_USER:root}
    password: ${MYSQL_PASSWORD:root}
  data:
    redis:
      host: 127.0.0.1
      port: 4379
      password: ${REDIS_PASSWORD:}

# Q10 决策：默认关 Nacos
nacos:
  config:
    enabled: false # 开启 = true；关闭时走本地 yml
```

### 8.7 Nacos Console

- 地址：`http://127.0.0.1:4848/nacos`（Nacos gRPC 内部端口 5848）
- 默认账号：`nacos` / `nacos`（dev）
- 进入「配置管理 → 配置列表」可手动创建 `java-admin.yaml` / `java-admin-dev.yaml`
- 切换 namespace：`java-admin-dev`

---

---

## 9. 配置中心（可插拔 Nacos）

**Q9 决策**：仅 Nacos Config，不引 Discovery。

### 9.1 Maven 依赖

- 引入 BOM（父 pom `<dependencyManagement>`）：
  ```xml
  <dependency>
      <groupId>com.alibaba.cloud</groupId>
      <artifactId>spring-cloud-alibaba-dependencies</artifactId>
      <version>2025.1.0.0</version>
      <type>pom</type>
      <scope>import</scope>
  </dependency>
  ```
- api 模块引入 starter：
  ```xml
  <dependency>
      <groupId>com.alibaba.cloud</groupId>
      <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
  </dependency>
  ```

### 9.2 配置开关（Q10 决策）

`application.yml` 顶部：

```yaml
nacos:
  config:
    enabled: ${NACOS_CONFIG_ENABLED:false} # 默认关；dev/prod 各自覆盖
```

### 9.3 Java 条件装配

`infra/config/NacosConfig.java`：

```java
@Configuration
@ConditionalOnProperty(name = "nacos.config.enabled", havingValue = "true")
public class NacosConfig {
    // 占位类；spring-cloud-starter-alibaba-nacos-config 自动注入 NacosConfigService
    // 通过 spring.cloud.nacos.config.* 即可生效
}
```

> 不需要写 `@EnableNacosConfig` 注解；starter 自动装配。`@ConditionalOnProperty` 让 java-admin 在 Nacos 关闭时**完全不加载 Nacos autoconfig**。

### 9.4 Nacos 服务端配置（Q12 决策）

`application-dev.yml`（仅当 `nacos.config.enabled=true` 时生效）：

```yaml
spring:
  application:
    name: java-admin
  cloud:
    nacos:
      config:
        server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:4848}
        username: ${NACOS_USER:nacos}
        password: ${NACOS_PASSWORD:nacos}
        namespace: java-admin-dev
        group: DEFAULT_GROUP
        file-extension: yaml
        # 双 dataId：共享 + 覆盖
        extension-configs:
          - dataId: java-admin.yaml
            group: DEFAULT_GROUP
            refresh: true
          - dataId: java-admin-dev.yaml
            group: DEFAULT_GROUP
            refresh: true
        # 启动失败重试（不崩溃）
        fail-fast: false
        retry:
          max-attempts: 3
          max-backoff: 5000
```

### 9.5 配置文件分层（Q12 决策）

| dataId                         | 内容                                                    | 何时加载        |
| ------------------------------ | ------------------------------------------------------- | --------------- |
| `java-admin.yaml`              | 公共配置（端口、Sa-Token、easy-query、logback）         | 总是            |
| `java-admin-dev.yaml`          | dev 覆盖（MySQL/Redis 地址、Flyway 路径、traceId 开关） | dev profile 时  |
| `java-admin-prod.yaml`（后续） | prod 覆盖（环境变量、prod Flyway 路径）                 | prod profile 时 |

加载顺序（后加载覆盖前加载）：`java-admin.yaml` → `java-admin-dev.yaml`。

### 9.6 降级路径

- **Nacos 服务端宕机**：`fail-fast: false` + `max-attempts: 3` 让应用**继续启动**，回退到 `application.yml` 兜底
- **降级日志**：写 WARN，不写 ERROR（避免触发告警）
- **运行时 Nacos 拉取失败**：`@NacosValue` 注解的字段取**启动时的快照值**，不抛异常
- **测试验证**：`NacosConfigTest` mock `NacosConfigProperties`，验证 `enabled=false` 时不创建相关 bean
- **SC Alibaba 2025.1.x 双启动失败模式**：
  - 模式 A（`No spring.config.import property has been defined`）：**关闭** `spring.cloud.nacos.config.import-check.enabled=false`，走老机制（`spring.cloud.nacos.config.*`），无 import-check
  - 模式 B（`IllegalArgumentException: dataId must be specified`）：**删除** `spring.config.import` 字段（不能留 `optional:nacos:` 形式），否则 `NacosConfigDataLocationResolver` 解析空 dataId 抛错
  - **本项目选方案**：模式 B 的"关闭 import-check + 删除 import"——与 `nacos.config.enabled` 开关 + `fail-fast: false` 协同最干净

### 9.7 与本地 yml 的优先级

- `application.yml`（本地）**总是**先加载，提供兜底
- Nacos 配置**后加载**，覆盖本地同名 key
- 这样即使 Nacos 拉取失败，本地兜底仍生效

---

---

## 10. 权衡 / Trade-offs

| 决策             | 选项                                  | 选择                                     | 理由                                      |
| ---------------- | ------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| ORM              | MyBatis-Plus / JPA / Easy-Query       | Easy-Query                               | 用户指定；且代理 API 类型安全             |
| 鉴权             | Spring Security / Shiro / Sa-Token    | Sa-Token                                 | 用户指定；轻量、注解友好                  |
| Token 模式       | JWT / Redis                           | Redis                                    | 用户明确不要 JWT；天然支持踢人/续期       |
| 限流             | Sentinel / Guava / Redisson           | **本版本不实现限流**（用户最终决策）     | 后续如需可加任务                          |
| 日志             | Log4j2 / Logback                      | Logback                                  | Spring Boot 默认，零配置                  |
| 响应体格式       | 4 字段（含 traceId） / 3 字段（不含） | **3 字段 `{code, msg, data}`**           | Q13 决策；traceId 走响应头                |
| Spring Boot 版本 | 3.5 LTS / 4.0                         | 4.0.x（最新 GA）                         | 用户要求最新版                            |
| 密码哈希         | MD5 / BCrypt / Argon2                 | BCrypt                                   | 简单可靠、Sa-Token 内置                   |
| 模块数           | 1 / 2 / 3 / 4                         | 4                                        | 用户指定；预留扩展                        |
| DB 迁移          | `spring.sql.init` / Flyway            | Flyway                                   | 用户要求；DDL/DML 分离；支持回滚          |
| Dev 依赖编排     | 本地装 / Docker Compose               | Docker Compose                           | 用户要求；一键起 dev 环境                 |
| Compose 范围     | dev 依赖 / 包含 app                   | dev 依赖（不含 app）                     | dev 用 mvn spring-boot:run 跑，方便热重载 |
| Flyway 范围      | DDL+DML 同文件 / 分离                 | V1 DDL + V2 DML                          | Flyway 主流做法；Q7 决策                  |
| DB 约定          | 完全对齐 v5 / 完全不对齐 / 部分对齐   | 部分对齐（snake_case + BIGINT UNSIGNED） | Q5 决策；MVP 不过度                       |
| 默认账户注入     | Flyway 注入 / Runner / 双 SQL         | Flyway V2 + dev/prod 隔离                | Q8 决策；prod 零种子用户                  |
| Compose 位置     | backend 顶层 / 模块下                 | 模块下（`backend/java-admin/deploy/`）   | Q6 决策；java-admin 可独立 clone 跑       |
| 配置中心         | 本地 yml / Apollo / Nacos             | Nacos                                    | 用户要求；可插拔                          |
| Nacos 范围       | Config / Discovery / 两者             | 仅 Config                                | Q9 决策；单体不需要 Discovery             |
| Nacos 接入       | 强制 / profile / 配置开关             | `@ConditionalOnProperty` + 本地 yml 降级 | Q10 决策；默认 false 保持零依赖启动       |
| Nacos 部署       | compose 默认 / profile / 外部         | compose 默认启动                         | Q11 决策；dev 一键起                      |
| Nacos 命名       | 共享 namespace / 独立 namespace       | 独立 namespace + 双 dataId               | Q12 决策；可演进多环境                    |

---

## 11. 兼容性 / 风险

| 风险                                                               | 缓解                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spring Boot 4 与旧库不兼容（如 Lombok、MapStruct）                 | 用 Spring Boot 4 BOM 统一管理版本；锁 Lombok 1.18.30+                                                                                                                    |
| Easy-Query Spring Boot 4 starter 较新，可能有 bug                  | 锁版本到最新 GA；启动时观察 `easy-query` banner 与启动日志                                                                                                               |
| Sa-Token 1.44.x 与 Spring Boot 4 未明确测试                        | 关注 `cn.dev33:sa-token-spring-boot-starter` 是否需要 1.45+（待 `task.py start` 前再次核版本）                                                                           |
| Redisson 与 Spring Boot 4 的 `redisson-spring-boot-starter` 兼容性 | 锁 `redisson-spring-boot-starter:4.5.0`（V4 适配 SB 4）；同时 `spring.autoconfigure.exclude` 排除 V2（V2 是空标记类，在 SB 4 新机制下抛 `Failed to generate bean name`） |
| Knife4j 4.x 与 Spring Boot 4                                       | 文档未明确说支持 SB4，但 Jakarta starter 在 SB3 已验证；4.x 版本声明兼容 Jakarta EE 10，SB4 内嵌 Jakarta 10                                                              |
| **JDK 17 缺失，环境只有 JDK 25**                                   | 当前环境 JDK 25（25.0.3），落在 SB4 支持范围（17-26）；用 `<java.version>17</java.version>` 锁定字节码，运行时用 JDK 25 启动                                             |
| **Flyway 10.x 与 Spring Boot 4**                                   | Flyway 10.20+ 已声明兼容 SB 4；若启动报 `flyway.version.incompat` 降到 9.22                                                                                              |
| **Docker Compose v5.1.4 与语法差异**                               | 锁定 `version: '3.9'`；用 `docker compose config -q` 校验；CI 跑这一步                                                                                                   |
| **MySQL `BIGINT UNSIGNED` 范围 vs Java `Long`**                    | Java Long 最大 2^63-1，MySQL UNSIGNED BIGINT 最大 2^64-1；本项目用 `Long` 即可（ID 永远到不了 2^63）；如未来要支持更大 ID 改 `BigInteger`                                |
| **Compose 默认密码**                                               | `.env.example` 给出占位，`.env` 不入仓（`.gitignore` 排除）                                                                                                              |
| **Spring Cloud Alibaba 2025.1.x 与 Spring Boot 4**                 | ctx7 文档明确：2025.1.x 对应 SB 4.0.x + JDK 17+；本项目 BOM 用 `2025.1.0.0`                                                                                              |
| **Nacos 2.x 与 Spring Cloud Alibaba 版本对齐**                     | 用 BOM 统一管理；不单独指定 nacos-client 版本                                                                                                                            |
| **Nacos 2.x gRPC 端口强约束**                                      | gRPC 端口 = HTTP 端口 + 1000；Nacos 客户端自动派生，无法改到 4xxx。HTTP 4848 + gRPC 5848 是本项目最终值                                                                  |
| **Nacos 拉取失败导致启动失败**                                     | `fail-fast: false` + `max-attempts: 3`；降级到本地 yml；只 WARN 不 ERROR                                                                                                 |
| **Nacos 数据持久化（dev 用 Derby）**                               | dev 用内置 Derby；prod 必改 MySQL（`SPRING_DATASOURCE_PLATFORM=mysql` + 配 jdbc URL）                                                                                    |

---

## 12. 回滚 / Rollback

- 本任务为**新建工程**，不涉及线上回滚
- 如果验收不通过：直接 `rm -rf backend/java-admin/` + `rm -rf .trellis/tasks/06-14-java-admin-backend/`，仓库回到 `00-bootstrap-guidelines` 之外无变更的状态
- git：所有改动都应在 commit 之前；如需紧急回滚，`git reset --hard HEAD~N`
- Docker Compose：清理 `docker compose down -v`（含 named volume）即彻底重置
- Nacos：清 `nacos_data` volume 即重置配置中心状态

---

## 13. 不在本次实现范围（记录用，避免误入）

- 任何业务模块
- 注册中心 / 配置中心
- 单元测试覆盖率 > 60% 之外的指标（如 mutation test、模糊测试）
- 国际化（i18n）
- Spring Doc 之外的 API 文档导出（Postman / Apifox）
- AOT / GraalVM Native Image（Spring Boot 4 已支持，但本次不做）
- java-admin 自身的 Dockerfile / 镜像构建
- 生产编排（K8s / Swarm / 阿里云容器）
- go-admin 的 `backend/db/schema.sql`（22 张表）— 与本任务无关，由后续业务任务决定是否对接
