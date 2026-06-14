# Logging 规范

> 统一日志规范：traceId 链路追踪 + Logback 配置 + 颜色支持（dev）。

---

## 1. 选型

- **SLF4J + Logback**（Spring Boot 默认）
- **`logback-spring.xml`**（**不是** `logback.xml`）—— 让 Spring 解析 `<springProfile>` 块
- **traceId** 通过 **MDC**（`%X{traceId}`） + **响应头 `X-Trace-Id`** 暴露
- **dev 彩色输出**（`%clr`），**prod 纯文本**（明文 + JSON 文件双输出）

---

## 2. traceId 链路

### 2.1 入口：`TraceIdFilter`（`infra.log.TraceIdFilter`）

```java
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    private static final String MDC_KEY = "traceId";
    private static final String HEADER = "X-Trace-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) {
        String traceId = req.getHeader(HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        try {
            MDC.put(MDC_KEY, traceId);
            res.setHeader(HEADER, traceId);
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
```

要点（**Q13 决策**）：

- 接受**外部传入**的 `X-Trace-Id`（跨服务透传）
- 内部**无**时自动生成
- 响应头**总是**回写
- **`traceId` 不在响应 body**（响应体严格 3 字段 `{code, msg, data}`）

### 2.2 Controller / Service 不需要管

`MDC` 是 thread-local，spring 自带的同步 servlet 模型下**自动透传**到所有 `log.*()`。**不要**在 service 手动 `MDC.put`。

### 2.3 异步 / 跨线程

**默认 MDC 不会跨线程透传**。如用 `@Async` / `CompletableFuture.supplyAsync` / `ForkJoinPool`：

- 选项 A：用 Spring 的 `TaskDecorator` 包装 `Runnable`，把 MDC 上下文拷过去
- 选项 B：用 SLF4J 2.x 的 `MDC.getCopyOfContextMap()` + `MDC.setContextMap()`（手工传递）

**本项目 MVP 不涉及**，留待未来。

---

## 3. logback-spring.xml 模板

### 3.1 关键点

1. **必须用 `logback-spring.xml`**（**不是** `logback.xml`）—— SB 才能解析 `<springProfile>`
2. **`<conversionRule>` 必须在 `<configuration>` 顶层**（**不是** profile 内）
3. **`class=`**（**不是** deprecated `converterClass=`）
4. **appender 必须放对应 `<springProfile>` 块内**（**否则**启动 WARN "Appender not referenced"）
5. **dev 启用 `STDOUT_COLOR`**（彩色 + 短格式），**prod 用 `STDOUT` + `FILE`**（明文 + JSON 文件双输出）

### 3.2 完整模板

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration scan="false">

    <!-- 关键 1：必须顶层 + class= 不用 deprecated converterClass= -->
    <conversionRule conversionWord="clr" class="org.springframework.boot.logging.logback.ColorConverter"/>

    <!-- 关键 2：dev 启动 ANSI 自动检测（SB 4 不自动检） -->
    <property name="LOG_PATTERN_CONSOLE" value="%d{yyyy-MM-dd HH:mm:ss.SSS} %5p [%X{traceId:-}] %15.15logger{39} - %clr(%m){blue}%n"/>
    <property name="LOG_PATTERN_FILE" value="%d{yyyy-MM-dd HH:mm:ss.SSS} %5p [%X{traceId:-}] %15.15logger{39} - %m%n"/>

    <!-- 关键 3：appender 放 profile 块内 -->
    <springProfile name="dev">
        <appender name="STDOUT_COLOR" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>${LOG_PATTERN_CONSOLE}</pattern>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="STDOUT_COLOR"/>
        </root>
        <logger name="com.wshake" level="DEBUG"/>
    </springProfile>

    <springProfile name="prod">
        <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>${LOG_PATTERN_FILE}</pattern>
            </encoder>
        </appender>
        <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>${LOG_PATH:-./logs}/java-admin.log</file>
            <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
                <fileNamePattern>${LOG_PATH:-./logs}/java-admin.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
                <maxFileSize>100MB</maxFileSize>
                <maxHistory>30</maxHistory>
            </rollingPolicy>
            <encoder>
                <pattern>${LOG_PATTERN_FILE}</pattern>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="STDOUT"/>
            <appender-ref ref="FILE"/>
        </root>
    </springProfile>

    <!-- 默认 fallback（没有 profile 时） -->
    <root level="INFO">
        <appender name="STDOUT_FALLBACK" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>${LOG_PATTERN_FILE}</pattern>
            </encoder>
        </appender>
    </root>

</configuration>
```

---

## 4. SB 4 颜色支持踩坑（防回归）

### 4.1 错误 A：`%clr` 报 "no applicable action"

```
ERROR in ch.qos.logback.core.joran.spi.Interpreter@... - Action invocation failed for "appender"
ERROR ... Conversion word "clr" not in list of keywords
```

**根因**：Logback 1.5.x 下 `%clr` 转换器**未自动注册**。SB 4 删了自动注册。

**修复**：在 `<configuration>` 顶层**显式注册** ColorConverter（**不是** deprecated `converterClass`）：

```xml
<conversionRule conversionWord="clr" class="org.springframework.boot.logging.logback.ColorConverter"/>
```

### 4.2 错误 B：`ConversionRule action class [org.springframework.boot.logging.logback.ColorConverter] does not implement ...`

**根因**：用错了 deprecated 属性名 `converterClass=`。

**修复**：用 `class=`：

```xml
<conversionRule conversionWord="clr" class="...ColorConverter"/>
```

### 4.3 错误 D：启动 WARN `Appender named [X] not referenced`

**根因**：appender 定义在 `<configuration>` 顶层（**不是** profile 内），启动时没匹配的 profile 加载，**无人引用**。

**修复**：appender 必须放对应 `<springProfile>` 块内。顶层 `<root>` 的 fallback 也要用 `<appender>` 直接定义（**不是** `<appender-ref>`）。

---

## 5. 启动颜色支持（application-dev.yml）

```yaml
spring:
  output:
    ansi:
      enabled: always # dev 强制彩色
```

`prod` profile **不**设（默认 DETECT，根据 terminal 是否支持 tty 决定）。

---

## 6. 日志级别

| 模块/包               | dev     | prod   | 说明                 |
| --------------------- | ------- | ------ | -------------------- |
| `com.wshake`          | `DEBUG` | `INFO` | 业务代码             |
| `com.easy-query`      | `INFO`  | `INFO` | ORM 框架             |
| `org.springframework` | `INFO`  | `INFO` | 框架默认             |
| `org.hibernate`       | `WARN`  | `WARN` | 噪音少               |
| `org.apache.tomcat`   | `INFO`  | `INFO` | 容器                 |
| `org.flywaydb`        | `INFO`  | `INFO` | 迁移（手工跑会 log） |
| `io.lettuce.core`     | `WARN`  | `WARN` | Redis 客户端         |
| `io.netty`            | `WARN`  | `WARN` | 噪音多               |

dev 全局 INFO + `com.wshake` DEBUG 写到 `application-dev.yml`：

```yaml
logging:
  level:
    com.wshake: DEBUG
```

---

## 7. 业务日志规范

### 7.1 用 SLF4J（**不**用 `System.out.println`）

```java
@Slf4j
@Service
public class AuthService {
    public void login(String username) {
        log.info("user login: username={}", username);   // ✅
        System.out.println("login: " + username);        // ❌
    }
}
```

### 7.2 不用 `+` 拼字符串（用占位符）

```java
log.info("user login: username={}, ip={}", username, ip);   // ✅ 占位符（懒求值）
log.info("user login: username=" + username);                // ❌ 永远拼字符串
```

### 7.3 异常日志

```java
try {
    // ...
} catch (Exception e) {
    log.error("operation failed: op={}, id={}", "login", id, e);  // 最后一个参数传异常
}
```

**不要**用 `log.error(e.getMessage())`——丢栈。

### 7.4 不在循环里 log（高 QPS 场景）

```java
for (User user : users) {
    log.debug("processing user: {}", user.getId());  // ❌
    process(user);
}
log.debug("processed users: count={}", users.size());  // ✅ 汇总
```

---

## 8. 常见错误（防回归）

| 错误                                          | 现象                                              | 规避                                     |
| --------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| 写 `logback.xml`                              | `<springProfile>` 不生效                          | 写 `logback-spring.xml`                  |
| `<conversionRule>` 放 profile 内              | dev 有颜色，prod 报 "Conversion word not in list" | 放 `<configuration>` 顶层                |
| 用 `converterClass=`                          | 启动报 "does not implement"                       | 用 `class=`                              |
| appender 放顶层 + `<appender-ref>` 放 profile | 启动 WARN "Appender not referenced"               | appender 与 ref 同在 profile 块          |
| `traceId` 写到响应 body                       | 响应体字段从 3 变成 4                             | 严格 3 字段，traceId 只在响应头          |
| MDC 跨线程丢                                  | 异步 task log 缺 traceId                          | 未来要时加 `TaskDecorator`               |
| `log.info("a" + b + "c")` 字符串拼接          | 浪费 CPU                                          | 用 `{}` 占位符                           |
| 异常只 log `e.getMessage()`                   | 丢栈                                              | `log.error("...", e)` 最后一个参数传异常 |
| dev 终端黑底白字（无颜色）                    | `spring.output.ansi.enabled` 没设                 | dev 设 `always`                          |

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
