# Flyway 迁移规范

> 本项目 **不用** Spring Boot 自动装配的 Flyway（**SB 4 下不触发**）—— 写 `FlywayMigrator` 手工 `Flyway.migrate()`。

---

## 1. 选型

- **Flyway 10.20.0**（`flyway-mysql` + `flyway-core`）
- **手动装配**：`FlywayMigrator implements ApplicationRunner`，**不**用 SB 的 `FlywayAutoConfiguration`
- 路径策略：**profile 区分 location**（dev 含 V1+V2 种子；prod 只含 V1）
- **无 baseline**，从空库开始

### 1.1 为什么不用自动装配

SB 4 启动 log 观察：`FlywayCommunityEditionAutoConfiguration` / `FlywayConfiguration` **从未被加载**（没 log 提示 `flyway` 字样）。原因不明（可能 SB 4 改了 autoconfig 加载条件），但 `spring.flyway.*` 走不通。

**修复**：写 `FlywayMigrator` `ApplicationRunner` 在启动早期手工调：

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class FlywayMigrator implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        String active = System.getProperty("spring.profiles.active",
                System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", "dev"));
        String location = active.contains("prod")
                ? "classpath:db/migration-prod"
                : "classpath:db/migration";

        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations(location)
                .baselineOnMigrate(false)
                .load();

        MigrateResult result = flyway.migrate();
        log.info("Flyway migrated: success={}, migrations executed={}",
                result.success, result.migrationsExecuted);
    }
}
```

---

## 2. 依赖

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
    <version>10.20.0</version>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
    <version>10.20.0</version>
</dependency>
```

---

## 3. 路径策略

```
java-admin-api/src/main/resources/
├── db/
│   └── migration/          # dev 用（含 V1 + V2）
│       ├── V1__init_sys_user.sql
│       └── V2__seed_admin_user.sql
└── db/
    └── migration-prod/     # prod 用（只含 V1）
        └── V1__init_sys_user.sql
```

`FlywayMigrator` 启动时**按 profile 选** location（见 §1.1 代码）。

---

## 4. SQL 命名

- **V1**、**V2**...：版本号（**必须连续**，不能跳号）
- **`__`**：两个下划线（Flyway 强制）
- **描述**：snake_case / kebab-case，如 `init_sys_user` / `seed_admin_user`
- **不要修改已部署的 SQL**——只能新增 V 脚本

```
V1__init_sys_user.sql
V2__seed_admin_user.sql
V3__add_user_email.sql
```

---

## 5. SQL 模板（**部分对齐** v5）

### V1 建表

```sql
-- V1__init_sys_user.sql

CREATE TABLE IF NOT EXISTS sys_user (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(64)  DEFAULT NULL,
    email         VARCHAR(128) DEFAULT NULL,
    phone         VARCHAR(32)  DEFAULT NULL,
    avatar        VARCHAR(255) DEFAULT NULL,
    create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_sys_user_username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
```

要点（**部分对齐** v5）：

- ✅ snake_case / `BIGINT UNSIGNED` / `utf8mb4_0900_ai_ci` / InnoDB
- ✅ `DATETIME`（**不**用 `TIMESTAMP`——**2038 年问题**）
- ❌ 不加 `deleted_at`（Q5 决策：无软删）
- ❌ 不加 `is_enabled`（Q5 决策：默认启用）
- ❌ 不加 7 字段审计（Q5 决策）

### V2 种子（**仅 dev**）

```sql
-- V2__seed_admin_user.sql
-- BCrypt hash of "admin123"
-- $2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2
INSERT INTO sys_user (username, password_hash, nickname, email)
VALUES ('admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '超级管理员', 'admin@local.host')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
```

要点（Q8 决策）：

- 仅 dev 加载（**prod 物理隔离**，没有 V2 文件）
- 默认账号 `admin` / `admin123`（仅 dev，**生产环境必须改**）
- `ON DUPLICATE KEY UPDATE` 让 V2 可重复执行

---

## 6. 与 SB 4 集成要点

### 6.1 不要配置 `spring.flyway.*`

```yaml
# ❌ 删掉这些配置（SB 4 下不生效）
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
```

### 6.2 排除 FlywayAutoConfiguration（避免无谓警告）

```yaml
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration
```

### 6.3 与 `defer-datasource-initialization: true` 关系

`FlywayMigrator` 是 `ApplicationRunner`，**晚于** Hikari 初始化但**早于**业务 bean。

- 业务 bean（`@Repository` 等）依赖 `EasyEntityQuery` 间接依赖 `DataSource`
- Hikari 启动 → Flyway 跑迁移 → 业务 bean 起来 → 查表
- **不**需要 `defer-datasource-initialization`（与 `spring.sql.init` 才相关）

---

## 7. 常见错误（防回归）

| 错误                       | 现象                              | 规避                                     |
| -------------------------- | --------------------------------- | ---------------------------------------- |
| 依赖 `spring.flyway.*`     | 启动无 Flyway log，迁移没跑       | 删配置，写 `FlywayMigrator` 手工跑       |
| `V2` 在 dev 和 prod 都有   | prod 也会建 admin 用户            | prod 用 `db/migration-prod`，**不含 V2** |
| V 脚本修改已部署的         | 上线后启动失败（checksum 不匹配） | 改了就新建 V 文件补；**不要**回改 V 脚本 |
| V 脚本跳号（V1 直接 V3）   | Flyway 报错                       | 连续递增                                 |
| `TIMESTAMP` 字段           | 2038 年问题                       | 统一用 `DATETIME`                        |
| `utf8` / `utf8mb3` 字符集  | emoji 乱码                        | 统一 `utf8mb4_0900_ai_ci`                |
| 字段名用驼峰               | 列名带大写，OSX 敏感会读不到      | 统一 snake_case                          |
| `bigint` 走默认 21B 有符号 | 未来容量紧张                      | 显式 `BIGINT UNSIGNED`                   |

---

## 8. 验证清单

每次写完 V 脚本，**必须**跑以下检查：

- [ ] 文件名形如 `V<数字>__<描述>.sql`
- [ ] SQL 在 dev / prod 库上都跑过（手动 `mysql -h ... < V1__init.sql`）
- [ ] `V1` 不含种子（避免 prod 误用）
- [ ] `V2` 仅在 dev 路径
- [ ] 字段名 snake_case / `BIGINT UNSIGNED` / `utf8mb4`
- [ ] `ON DUPLICATE KEY UPDATE` 让种子可重复执行
- [ ] 启动日志确认 `Flyway migrated: success=true, migrations executed=1`

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
