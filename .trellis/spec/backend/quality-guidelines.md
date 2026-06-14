# Quality Guidelines (Backend)

> 后端质量门禁：测试 + lint + type check + 验收清单。本文件定义**质量底线**与**回归检查表**。

---

## 1. 选型

- **测试**：JUnit 5（junit-jupiter 5.11.x）+ Mockito 5.x + AssertJ
- **断言**：AssertJ 风格（**不**用 JUnit 内置 `assertEquals`）
- **覆盖率**：本期**不**要求数字（dev-time 跑单测，不接 SonarQube）
- **集成测试**：用 `@SpringBootTest(webEnvironment = RANDOM_PORT)` 跑全栈
- **Mock**：用 `Mockito.mock()` / `@MockBean`（**不**用 PowerMock）
- **Lint**：项目**不**集成 Checkstyle / SpotBugs（MVP 阶段）；依赖 IDE 提示 + 命名规范

---

## 2. 测试分层

### 2.1 单元测试（`src/test/java/.../*Test.java`）

**目标**：单个类的方法，**不**起 Spring 容器。

```java
@Slf4j
class AuthServiceTest {

    private SysUserRepository userRepository;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(SysUserRepository.class);
        authService = new AuthService(userRepository);
    }

    @Test
    void should_login_success() {
        SysUser user = new SysUser();
        user.setId(1L);
        user.setUsername("admin");
        user.setPasswordHash("$2a$10$...");
        when(userRepository.findByUsername("admin")).thenReturn(user);

        String token = authService.login("admin", "admin123");
        assertThat(token).isNotBlank();
    }
}
```

**覆盖场景**：

- 正常路径
- 边界（null / 空 / 0 / MAX）
- 异常路径

### 2.2 配置测试（`src/test/java/.../config/*Test.java`）

**目标**：验证 yml / properties 加载正确，**起轻量容器**。

```java
@SpringBootTest(classes = Application.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "spring.profiles.active=test")
class NacosConfigTest {
    @Autowired
    private ConfigurableEnvironment env;

    @Test
    void nacos_disabled_in_dev() {
        // dev profile: NACOS_CONFIG_ENABLED=false
        assertThat(env.getProperty("nacos.config.enabled")).isEqualTo("false");
    }
}
```

### 2.3 集成测试（`src/test/java/.../integration/*IT.java`）

**目标**：跑全栈（HTTP + DB + Redis），验证 e2e。

**本项目 MVP 不要求** IT 测试（e2e 走人工 curl 验证），留待未来。

---

## 3. 测试命名

| 元素 | 命名                                                        | 例子                                                                               |
| ---- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 类   | `XxxTest`                                                   | `AuthServiceTest`, `NacosConfigTest`                                               |
| 方法 | `should_<behavior>_when_<condition>` 或 `should_<behavior>` | `should_login_success_when_credentials_valid`                                      |
| 包   | 与被测类同包                                                | `com.wshake.service.user.AuthServiceTest` 测 `com.wshake.service.user.AuthService` |

⚠️ **不要**用 `test_<method>`（JUnit 5 + AssertJ 风格优先）。

---

## 4. 测试目录结构

```
java-admin-service/src/test/java/com/wshake/service/
├── user/
│   └── AuthServiceTest.java
└── ...

java-admin-infra/src/test/java/com/wshake/infra/
├── config/
│   ├── NacosConfigTest.java
│   ├── NacosConfigTogglePropertiesTest.java
│   ├── RedissonAutoconfigCheckTest.java
│   └── SpringConfigImportCheckTest.java
├── exception/
│   └── GlobalExceptionHandlerTest.java
└── log/
    └── TraceIdFilterTest.java

java-admin-api/src/test/java/com/wshake/api/
├── common/
│   ├── NacosConfigFormatTest.java
│   └── ResultFormatTest.java
```

---

## 5. 测试运行

```bash
# 全模块
cd backend/java-admin
mvn test

# 单模块
mvn -f java-admin-service test
mvn -f java-admin-infra test
mvn -f java-admin-api test

# 单测试类
mvn -f java-admin-service test -Dtest=AuthServiceTest

# 单测试方法（surefire 3.x）
mvn -f java-admin-service test -Dtest=AuthServiceTest#should_login_success
```

---

## 6. Mock vs 真实

| 场景             | 用 Mock                   | 用真实                           |
| ---------------- | ------------------------- | -------------------------------- |
| Repository / DAO | ✅ 单元测试               | ⚠️ IT 测试                       |
| Redis 客户端     | ✅ 单元测试               | ⚠️ IT 测试                       |
| Spring 容器      | ❌                        | ✅（`@SpringBootTest`）          |
| Flyway           | ❌                        | ✅（`@SpringBootTest` 启动时跑） |
| Sa-Token         | ⚠️ 单元测试 Mock          | ⚠️ IT 测试                       |
| 时间 / UUID      | ⚠️ 用 `Clock` 注入或 Mock | ❌                               |

**不要**用 PowerMock / ByteBuddy Agent 强改 final class（用 Mockito 5.x inline mock）。

---

## 7. e2e 验证清单（每次发版前必跑）

> 自动化测试不能覆盖的边界，用 curl 走一遍。

```bash
# 1. 启动
cd backend/java-admin
mvn -DskipTests package
java -jar java-admin-api/target/java-admin-api.jar

# 2. 验证 health（Knife4j）
curl -s http://localhost:4080/v3/api-docs | head -c 200

# 3. 验证登录
LOGIN=$(curl -s -X POST http://localhost:4080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}')
echo $LOGIN | jq
TOKEN=$(echo $LOGIN | jq -r .data.token)
[ ${#TOKEN} -eq 36 ] && echo "Token length OK (36)" || echo "Token length WRONG"

# 4. 验证 token 拿用户信息
curl -s -H "satoken: $TOKEN" http://localhost:4080/api/v1/auth/info | jq

# 5. 验证无 token 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4080/api/v1/auth/info
# 期望 401

# 6. 验证登出
curl -s -X POST -H "satoken: $TOKEN" http://localhost:4080/api/v1/auth/logout | jq

# 7. 验证 traceId
curl -i -X POST http://localhost:4080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: my-trace-001' \
  -d '{"username":"admin","password":"admin123"}' | head -20
# 期望响应头 X-Trace-Id: my-trace-001
# 期望响应体不含 traceId
```

---

## 8. 验收清单（PR 合并前必过）

### 8.1 功能

- [ ] 4 模块都通过 `mvn test`（40 个测试，0 failure）
- [ ] 启动无 `BeanCreationException` / `UnsatisfiedDependencyException`
- [ ] 启动无 `Conversion word "clr" not in list of keywords` 警告
- [ ] 启动无 `Appender named [X] not referenced` 警告
- [ ] 启动无 `unknown property nacos.config.enabled` 警告
- [ ] e2e login → info → logout 全通
- [ ] 无 token 访问 protected 资源 → HTTP 401
- [ ] 响应体严格 3 字段（不含 `traceId` / `success`）
- [ ] 响应头 `X-Trace-Id` 总是存在
- [ ] 外部传入 `X-Trace-Id` 优先

### 8.2 配置

- [ ] `application.yml` 公共配置不含密码明文
- [ ] `application-dev.yml` 显式设 `spring.output.ansi.enabled=always`
- [ ] `application-prod.yml` 走环境变量注入
- [ ] dev 默认关 Nacos（`NACOS_CONFIG_ENABLED:false`）
- [ ] docker compose 端口走 4000 段

### 8.3 规范

- [ ] 不引 `com.alibaba.cloud:spring-cloud-*`（用 `nacos-config-spring-boot-starter`）
- [ ] 不在 `common` 引 spring 业务 starter
- [ ] `application-dev.yml` 等 `application-*.yml` 只在 `java-admin-api` 模块
- [ ] `logback-spring.xml`（**不是** `logback.xml`）
- [ ] 实体加 `@EntityProxy` + 实现 `ProxyEntityAvailable`
- [ ] 密码哈希用 BCrypt（**不**明文 / MD5 / SHA-1）

### 8.4 文档

- [ ] 任何**踩坑**踩出来的新约束，已写回 `.trellis/spec/backend/*.md`
- [ ] `.trellis/spec/backend/index.md` 更新（如果新增 spec 文件）
- [ ] README 增 / 改

---

## 9. 常见错误（防回归）

| 错误                                                         | 现象                      | 规避                                       |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------ |
| Mock 了 final 类                                             | `Cannot mock final class` | Mockito 5 inline（`mockito-inline`）       |
| `@SpringBootTest` 跑单元测试                                 | 启动慢、CI 慢             | 单元测试**不**起容器                       |
| `@MockBean` 已 deprecated                                    | SB 3.4+ 用 `@MockitoBean` | 改 `@MockitoBean`                          |
| 共享 `@SpringBootTest` 上下文                                | 测 A 跑完脏状态影响测 B   | 用 `@DirtiesContext` 或隔离 test class     |
| 测试依赖执行顺序                                             | 一个测 fail 后续跟着 fail | 测之间独立，**不**共享 mutable state       |
| `@Disabled` 屏蔽 fail 测试                                   | 漏洞埋雷                  | 修或删，**不**用 @Disabled 逃避            |
| 测试数据库用 H2                                              | 与 MySQL 行为差异         | 测用真实 MySQL 容器（Testcontainers 未来） |
| 集成测试写在 `src/test/java/.../XxxIT.java` 但 maven 不跑 IT | 测永远不跑                | 配置 `maven-failsafe-plugin`（未来）       |

---

## 10. 不在范围内

- ❌ SonarQube / Code Coverage 数字（dev-time 跑单测）
- ❌ 性能测试（JMH / Gatling）
- ❌ 契约测试（Pact）
- ❌ 端到端 UI 自动化（Selenium / Playwright）
- ❌ 安全扫描（OWASP Dependency-Check）—— dev 不上；prod 上线前再集成

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
