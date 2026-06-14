# Nacos Config 规范（可插拔）

> 本项目用 **Nacos 官方独立 starter**：`com.alibaba.nacos:nacos-config-spring-boot-starter`（0.2.2+），**不用** spring-cloud-alibaba 那套。

---

## 1. 选型

- **版本**：Nacos server 2.4.3（容器内）；starter `nacos-config-spring-boot-starter` 0.2.2+
- **Starter**：`com.alibaba.nacos:nacos-config-spring-boot-starter`（**不是** `com.alibaba.cloud:spring-cloud-starter-alibaba-nacos-config`）
- **范围**：**仅 Config**，不引 Discovery（单体无意义）
- **属性前缀**：`nacos.config.*`（**不是** `spring.cloud.nacos.config.*`）

### 1.1 为什么不用 spring-cloud-alibaba

| 维度                 | 旧（spring-cloud-alibaba）                                    | 新（nacos-config-spring-boot-starter）                                    |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 依赖                 | `com.alibaba.cloud:spring-cloud-starter-alibaba-nacos-config` | `com.alibaba.nacos:nacos-config-spring-boot-starter`                      |
| BOM                  | `spring-cloud-alibaba-dependencies`                           | 无需（直接用 starter）                                                    |
| 属性前缀             | `spring.cloud.nacos.config.*`                                 | `nacos.config.*`                                                          |
| 启用开关             | 自己写 `nacos.config.enabled` + `@ConditionalOnProperty`      | 删掉 `spring.config.import=...` 行就行                                    |
| import-check         | 还要 `import-check.enabled: false`                            | **内置**，不用关                                                          |
| dataId/group refresh | `extension-configs: [{dataId, refresh: true}]`（camelCase）   | `extension-configs: [{data-id, refresh-enabled: true}]`（**kebab-case**） |
| 失败降级             | `fail-fast: false` + retry                                    | **内置降级**，不用配                                                      |

---

## 2. 依赖

```xml
<dependency>
    <groupId>com.alibaba.nacos</groupId>
    <artifactId>nacos-config-spring-boot-starter</artifactId>
    <version>0.2.2+</version>
</dependency>
```

---

## 3. application.yml 模板

```yaml
spring:
  application:
    name: java-admin

  # 端口策略：4000 段（避开 80xx/3306/6379/8848 等常见 dev 冲突）
  cloud:
    nacos:
      # 公共 server 配置（config.* 自动继承这些值，metadata 默认值就是 ${...}）
      server-addr: ${NACOS_SERVER_ADDR:127.0.0.1:4848}
      username: ${NACOS_USER:nacos}
      password: ${NACOS_PASSWORD:nacos}
      config:
        # 与新 starter 的 spring.config.import 行为兼容
        import-check:
          enabled: false
        namespace: ${NACOS_NAMESPACE:java-admin-dev}
        group: ${NACOS_GROUP:DEFAULT_GROUP}
        file-extension: yaml
        # 双 dataId（Q12 决策）：共享 + dev 覆盖
        # ⚠️ kebab-case：data-id / refresh-enabled（starter metadata 真实字段名）
        extension-configs:
          - data-id: java-admin.yaml
            group: DEFAULT_GROUP
            refresh-enabled: true
          - data-id: java-admin-dev.yaml
            group: DEFAULT_GROUP
            refresh-enabled: true

# Nacos 启用开关（Q10 决策，被 NacosConfigToggleProperties @ConfigurationProperties 绑定）
# 默认 false：dev profile 不连 Nacos，prod 用 env 变量打开
# 与 spring.cloud.nacos.config.enabled 同义
nacos:
  config:
    enabled: ${NACOS_CONFIG_ENABLED:false}
```

---

## 4. 启停机制（@ConditionalOnProperty + ConfigurationProperties）

### 4.1 不要自己写 `saTokenDao` bean

1.45.0 starter 自动装配 `SaTokenDaoForRedisTemplate`，**禁止**在 `SaTokenConfig` 重复定义（会双 bean 冲突）。`SaTokenConfig` 只保留工具方法。

### 4.2 自己的属性类（IDE 可导航 + 消 "unknown property" warning）

```java
@Data
@ConfigurationProperties(prefix = "nacos.config")
public class NacosConfigToggleProperties {
    private boolean enabled = false;
}
```

```java
@Configuration
@EnableConfigurationProperties(NacosConfigToggleProperties.class)
@ConditionalOnProperty(prefix = "nacos.config", name = "enabled", havingValue = "true")
public class NacosConfig {
    // 占位。starter 自动装配。
}
```

**好处**：

- IDE 在 yml 写 `nacos.config.enabled` → **Ctrl+Click 跳到 `enabled` 字段**
- Spring Boot 知道这属性被消费（**无 "unknown property" warning**）
- 类型安全：`boolean` 字段有 IDE 推断

---

## 5. Spring Boot 4 启动失败模式（防回归）

### 模式 A：`No spring.config.import property has been defined`

```
APPLICATION FAILED TO START
No spring.config.import property has been defined
Action: Add a spring.config.import=nacos: property to your configuration.
```

**修复（任选一）**：

| 方案                          | 配置                                                    | 效果                                      |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| 强制 Nacos                    | `spring.config.import=nacos:`                           | 启动必须连 Nacos                          |
| 可选 Nacos                    | `spring.config.import=optional:nacos:`                  | Nacos 不可用时降级 WARN                   |
| **关闭 import-check（推荐）** | `spring.cloud.nacos.config.import-check.enabled: false` | 走老机制（`spring.cloud.nacos.config.*`） |

### 模式 B：`dataId must be specified`（典型踩坑）

```
java.lang.IllegalArgumentException: dataId must be specified
```

**根因**：声明了 `spring.config.import=optional:nacos:`（**没**带 dataId 部分），
`NacosConfigDataLocationResolver.dataIdFor(uri)` 返回空字符串，直接抛异常。

**错误示范**：

```yaml
spring:
  config:
    import: "optional:nacos:" # ❌ 缺 dataId，必抛 IllegalArgumentException
```

**修复（任选一）**：

| 方案                          | 配置                                                          | 说明                                      |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------- |
| 给 import 补 dataId           | `import: "optional:nacos:java-admin"`                         | 新机制接管；可与 extension-configs 叠加   |
| **关闭 import-check（推荐）** | `import-check.enabled: false` + **删** `spring.config.import` | 走老机制（`spring.cloud.nacos.config.*`） |

#### 本项目选择：模式 B 的"关闭 import-check + 删除 import"

理由：

1. 已经用 `nacos.config.enabled` 开关（Q10 决策），不需要新机制的双重开关
2. 老机制天然支持 `extension-configs` 多 dataId（Q12 决策）
3. 与 `fail-fast: false` 协同简单，关闭 import-check 后只走老机制
4. 减少一类配置心智负担

---

## 6. `spring.config.import` 必填说明

Spring Cloud Alibaba **2025.1.x**（Nacos config starter）启动时会执行 `import-check`：要求 `spring.config.import` 中显式声明 Nacos，否则报：

```
APPLICATION FAILED TO START
No spring.config.import property has been defined
Action: Add a spring.config.import=nacos: property to your configuration.
        If configuration is not required add spring.config.import=optional:nacos: instead.
        To disable this check, set spring.cloud.nacos.config.import-check.enabled=false.
```

**三种解决方案**：

| 方案                           | 配置                                                   | 效果                                        |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------- |
| 强制 Nacos（不可用时启动失败） | `spring.config.import=nacos:`                          | 启动必须连 Nacos                            |
| **可选 Nacos（推荐）**         | `spring.config.import=optional:nacos:`                 | Nacos 不可用时降级到本地 yml；WARN 不 ERROR |
| 关闭 import-check              | `spring.cloud.nacos.config.import-check.enabled=false` | 启动不报错，但 Nacos 拉取仍可能失败         |

**本项目用 optional: 方案**（与 `nacos.config.enabled` 开关、`fail-fast: false` 协同）。

---

## 7. dataId 命名约定

| dataId                         | 内容                                                    | 何时加载     |
| ------------------------------ | ------------------------------------------------------- | ------------ |
| `java-admin.yaml`              | 公共配置（端口、Sa-Token、easy-query、logback）         | 总是         |
| `java-admin-dev.yaml`          | dev 覆盖（MySQL/Redis 地址、Flyway 路径、traceId 开关） | dev profile  |
| `java-admin-prod.yaml`（后续） | prod 覆盖（环境变量、prod Flyway 路径）                 | prod profile |

加载顺序（后加载覆盖前加载）：`java-admin.yaml` → `java-admin-dev.yaml` → `application.yml`（兜底）。

---

## 8. namespace 策略

- 每个环境**独立 namespace**（避免误改其他环境）
- namespace 命名：`java-admin-<env>`，例：`java-admin-dev` / `java-admin-prod` / `java-admin-test`
- **不**用 `public`（容易误操作）
- 在 Nacos Console 的「命名空间」菜单创建

---

## 9. 降级路径（必须）

| 场景                  | 行为                                                                                     | 日志            |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| Nacos 服务端宕机      | `fail-fast: false` + `max-attempts: 3` 让应用**继续启动**，回退到 `application.yml` 兜底 | WARN            |
| namespace 不存在      | 降级到本地 yml                                                                           | WARN            |
| dataId 不存在         | 跳过该 dataId，继续加载其他                                                              | INFO            |
| 配置格式错误          | 该 key 跳过，其他 key 仍生效                                                             | ERROR（仅一条） |
| 运行时 Nacos 拉取失败 | `@NacosValue` 取启动时快照值                                                             | WARN            |

---

## 10. dev 启动流程

```bash
# 1. 起 Nacos（4000 段端口：4848/5848）
cd backend/java-admin/deploy
docker compose up -d nacos

# 2. 登录 Nacos console
open http://127.0.0.1:4848/nacos
# 默认账号：nacos / nacos

# 3. 创建 namespace
# 命名空间 → 新建 → 命名空间 ID=java-admin-dev，名称=Java Admin Dev

# 4. 创建配置
# 配置管理 → 配置列表 → 选 java-admin-dev namespace → 新增
#   dataId: java-admin.yaml
#   group: DEFAULT_GROUP
#   配置格式: YAML
#   配置内容: 公共配置
#   重复以上创建 java-admin-dev.yaml

# 5. 启动 java-admin（开 Nacos）
NACOS_CONFIG_ENABLED=true mvn -f java-admin-api spring-boot:run

# 6. 启动 java-admin（关 Nacos，本地兜底）
NACOS_CONFIG_ENABLED=false mvn -f java-admin-api spring-boot:run
```

---

## 11. 常见错误（防回归）

| 错误                                            | 现象                                        | 规避                                                                                                               |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `enabled` 写错位置                              | 配置不生效                                  | 启停开关放 `nacos.config.enabled`（自己的 toggle），**不要**放 `spring.cloud.nacos.config.enabled`（starter 内置） |
| `dataId` 写错                                   | 拉不到配置                                  | 双重确认 dataId/group/namespace                                                                                    |
| `file-extension` 写错（`yml` / `yaml`）         | Nacos 创建格式不匹配                        | 统一用 `yaml`                                                                                                      |
| 同时启 Nacos + 改本地 yml                       | 心智混乱                                    | 关闭 Nacos 时改本地，开启 Nacos 时改 Nacos                                                                         |
| 误用 `dataId`（camelCase）                      | 字段找不到，配置不绑                        | 用 **`data-id`**（kebab-case，starter metadata 真实字段名）                                                        |
| IDE 点 `nacos.config.enabled` 不跳转            | `@ConditionalOnProperty(name=...)` 无绑定类 | 加 `@ConfigurationProperties` 类                                                                                   |
| `unknown property nacos.config.enabled` warning | 启动时 log 警告                             | 同上（加 `@ConfigurationProperties`）                                                                              |

---

## 12. 不在范围内（明确）

- ❌ Nacos Discovery / 服务注册（单体不需要）
- ❌ Nacos Cluster 模式（dev 用 standalone）
- ❌ Nacos 权限模型 / RBAC 详细配置（dev 用默认账号）
- ❌ Nacos + Spring Cloud Gateway 集成
- ❌ Nacos Config 历史版本回滚 UI（用 API 或 Nacos Console 手动）

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
