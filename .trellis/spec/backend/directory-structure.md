# Directory Structure Guidelines

> Java Spring Boot 后端项目的目录结构与包路径约定。

---

## 1. 选型

- **多模块 Maven**（4 模块）
- **包名基线**：`com.wshake.<short-name>`（**已从 `com.javaadmin.*` 改名**）
- **基础设施**：`backend/java-admin/<module>/...`

### 1.1 为什么 4 模块

| 维度     | 单模块               | 多模块（本项目）              |
| -------- | -------------------- | ----------------------------- |
| 编译速度 | 改一处全量重编       | 改一模块只重编该模块          |
| 依赖隔离 | 工具类被业务任意依赖 | common 不能依赖 service/infra |
| 复用性   | 跨服务复制           | common 单独打 jar 复用        |
| 测试粒度 | 一次性全跑           | 改 common 只跑 common 单测    |

4 模块分工：

- **common**：工具类、Result 响应体、自定义异常、业务码枚举
- **service**：实体、Repository、业务 Service、Easy-Query ORM
- **infra**：config（Sa-Token、Redisson、Nacos、Web、Flyway）、filter、log、interceptor、exception handler
- **api**：唯一带 `@SpringBootApplication` 的模块；Controller、application\*.yml、Flyway SQL

### 1.2 依赖方向

```
api  →  infra  →  service  →  common
```

**严格禁止反向**：

- common 不引 service / infra / api
- service 不引 infra / api
- infra 不引 api
- api 引全部（启动模块）

---

## 2. 目录结构

```
backend/java-admin/
├── pom.xml                                  # 父 pom（dependencyManagement + pluginManagement）
├── java-admin-common/
│   ├── pom.xml
│   └── src/main/java/com/wshake/common/
│       ├── result/Result.java               # 统一响应 3 字段
│       ├── exception/                       # 业务异常（已废弃，见下）
│       ├── enums/                           # 业务码枚举
│       └── util/                            # 工具类
├── java-admin-service/
│   ├── pom.xml
│   └── src/main/java/com/wshake/service/
│       ├── entity/                          # Easy-Query 实体（@EntityProxy）
│       ├── repository/                      # 仓库（Easy-Query 封装）
│       ├── service/                         # 业务 Service
│       └── impl/
├── java-admin-infra/
│   ├── pom.xml
│   └── src/main/java/com/wshake/infra/
│       ├── config/                          # 配置类
│       ├── filter/                          # Filter
│       ├── interceptor/                     # Interceptor
│       ├── log/                             # traceId + logback
│       └── exception/                       # @RestControllerAdvice
└── java-admin-api/
    ├── pom.xml                              # 唯一带 @SpringBootApplication
    └── src/
        ├── main/
        │   ├── java/com/wshake/api/
        │   │   ├── Application.java
        │   │   ├── controller/              # REST controller
        │   │   └── common/                  # api 内的 DTO/VO
        │   └── resources/
        │       ├── application.yml
        │       ├── application-dev.yml
        │       ├── application-prod.yml
        │       ├── logback-spring.xml
        │       ├── db/migration/            # Flyway V1, V2
        │       └── db/migration-prod/       # Flyway V1
        └── test/
            └── java/                        # API 层集成测试
└── deploy/
    ├── docker-compose.yml
    ├── .env.example
    ├── .env                                 # gitignore
    ├── fix-docker-desktop-commit-failed.sh
    └── README.md
```

---

## 3. 关键约定

### 3.1 唯一 `@SpringBootApplication`

**只在 `java-admin-api` 模块**：

```java
package com.wshake.api;

@SpringBootApplication(scanBasePackages = "com.wshake")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

`scanBasePackages = "com.wshake"` 让 SB 扫到所有模块的 `@Component` / `@Service` / `@Repository` / `@RestController` / `@Configuration` / `@RestControllerAdvice`。

**为什么不在 common / service / infra 写 `@SpringBootApplication`**：会让这些模块不再可被其他项目复用。

### 3.2 业务码放在 `common.enums`

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
    // ...
}
```

**码段划分**：

- `0` 成功
- `1xxx` 业务一般错误
- `2xxx` 业务特定错误
- **`3xxx` 空缺**（**留给未来限流**，Q4 决策本期无限流）
- `4xxx` HTTP 状态码对齐
- `5xxx` 服务器内部

### 3.3 异常放在 `common.exception`

```java
public class BusinessException extends RuntimeException {
    private final int code;
    public BusinessException(int code, String message) { super(message); this.code = code; }
    public int getCode() { return code; }
}
```

⚠️ **2026-06-14 演进**：项目内**实际不使用** `BusinessException`（统一在 controller / service 用 `Result.error(code, msg)` 返回）。
详见 `error-handling.md`。如未来要"抛异常统一兜底"，再补 `BusinessException` + `GlobalExceptionHandler` 配对。

### 3.4 不在每个模块下放 application.yml

**只有 `java-admin-api/src/main/resources/application*.yml`**。Spring Boot 默认从 classpath 加载，common/service/infra 模块的 yml 不会自动被加载（除非 `spring.config.location` 显式指）。

### 3.5 不在 `common` 引 spring 业务 starter

common 是**纯业务抽象**，**不**引 `spring-boot-starter-web` / `spring-boot-starter-data-jpa` 等。
依赖：lombok + `spring-context`（`@JsonIgnore` 等需要）+ `jackson-annotations`（Result 用）。

### 3.6 包路径与 classpath 对应

Maven 标准：Java 文件路径必须与 `package` 一致。

```java
package com.wshake.common.result;  // 必须在 .../common/result/Result.java
```

**反例**（编译过但 IDE 警告）：

```java
package com.wshake.api.result;     // 在 .../common/result/Result.java
```

---

## 4. 命名约定

| 类别       | 命名                           | 例子                            |
| ---------- | ------------------------------ | ------------------------------- |
| 实体       | `Xxx` (Xxx 与表名同，**单数**) | `SysUser`                       |
| Repository | `XxxRepository`                | `SysUserRepository`             |
| Service    | `XxxService`                   | `AuthService`, `SysUserService` |
| Controller | `XxxController`                | `AuthController`                |
| 配置类     | `XxxConfig`                    | `SaTokenConfig`, `WebConfig`    |
| 拦截器     | `XxxInterceptor`               | `SaInterceptor`                 |
| Filter     | `XxxFilter`                    | `TraceIdFilter`                 |
| 工具类     | `XxxUtils`                     | `PasswordUtils`                 |

---

## 5. 与 Spring Boot 4 / Java 17 集成要点

### 5.1 Java 17 语言特性使用

| 特性                           | 用途                                             |
| ------------------------------ | ------------------------------------------------ |
| `record`                       | DTO/VO/查询参数（**不要**用在 entity / Service） |
| `sealed interface` + `permits` | 业务码类型（**可选**，本项目用 enum）            |
| `text block` `"""..."""`       | SQL / JSON 常量                                  |
| `var`                          | 长泛型局部变量（**慎用**，类型信息丢失）         |
| `Pattern Matching for switch`  | 4.0.x 编译器要求**Preview 特性**——**不**用       |

### 5.2 编译目标

`pom.xml` 父 pom 锁：

```xml
<properties>
    <java.version>17</java.version>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
</properties>
```

运行时可 JDK 17 / 25（两者都能启动 SB 4）。**首选 JDK 17**（JDK 25 + Netty 4.x 在 macOS 有 `CleanerJava24` 偶发崩溃）。

### 5.3 Lombok 版本

Lombok **1.18.38+**（**不要**用 1.18.34——JDK 25 报 `TypeTag UNKNOWN`）。

---

## 6. 常见错误（防回归）

| 错误                                  | 现象                        | 规避                                                      |
| ------------------------------------- | --------------------------- | --------------------------------------------------------- |
| common 引 spring-boot-starter-web     | common 不能被纯工具项目复用 | common 只引 lombok + spring-context + jackson-annotations |
| service 引 infra                      | 依赖方向违反                | 严格 `service → common`，不引 infra                       |
| 多个模块都有 `@SpringBootApplication` | 测试时扫冲突                | 只在 `java-admin-api`                                     |
| `scanBasePackages` 不设               | 跨模块 bean 找不到          | `scanBasePackages = "com.wshake"`                         |
| 业务码放 `service` 模块               | common 用不到               | 放 `common.enums`                                         |
| `Result` 放 `service` 模块            | controller 用不到           | 放 `common.result`                                        |
| 包名带 `com.javaadmin.*`              | 找不到 bean                 | 统一 `com.wshake.*`（本项目 2026-06-14 改名记录）         |

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
