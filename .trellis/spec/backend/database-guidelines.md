# Database Guidelines

> Database patterns and conventions for this project. 由首个 Java 后端模块落地时填写。

---

## 1. 选型

- **数据库**：MySQL 8.4（驱动 `com.mysql:mysql-connector-j`）
- **数据源**：HikariCP（Spring Boot 默认）
- **ORM**：**Easy-Query 3.2.12**（`com.easy-query:sql-springboot4-starter`，**Spring Boot 4 专用 starter**）
- **迁移**：**Flyway 10.20.0**（`flyway-mysql`），但**不用自动装配**——写 `FlywayMigrator.java` 手工调 `Flyway.migrate()`（详见 `infra-flyway.md`）

### 1.1 Easy-Query 版本约束（硬规则）

| Spring Boot 版本    | 必须用的 starter              | 原因                         |
| ------------------- | ----------------------------- | ---------------------------- |
| 3.x                 | `sql-springboot-starter`      | 老 starter（v3 系列）        |
| **4.0.x（我们用）** | **`sql-springboot4-starter`** | SB 4 专用 starter（v4 系列） |
| 5.x+                | 未来再看                      | —                            |

⚠️ **不要**用 `sql-springboot-starter`（不带 4）在 SB 4 下，会启动失败 / 行为异常。

## 2. 关键参考路径

| 名称                          | 链接                                       | 用途                                        |
| ----------------------------- | ------------------------------------------ | ------------------------------------------- |
| Easy-Query 用户给出的参考路径 | https://github.com/wzszsw/easy-query-orm   | 开发者原始引用的入口（可能是 fork 或 typo） |
| Easy-Query 实际主仓库         | https://github.com/xuejmnet/easy-query     | Java/Kotlin ORM 主仓，**真实依赖来源**      |
| Easy-Query 文档仓             | https://github.com/xuejmnet/easy-query-doc | 官方中文文档，API、starter、示例            |
| Easy-Query Gitee 镜像         | https://gitee.com/xuejm/easy-query         | 国内访问备选                                |

> ⚠️ 实际引入坐标以 `xuejmnet/easy-query` 为准；写代码或查 API 时优先用 `xuejmnet/easy-query-doc` 的目录（`src/guide/...`）。
> 当 ctx7 检索 "easy-query" 时，**首选** ID 为 `/xuejmnet/easy-query-doc`（benchmark 84.67），次选 `/dromara/easy-query`（benchmark 67.25，注意 dromara 的是 Easy-Query **插件**而非主仓）。

## 3. Maven 依赖

```xml
<!-- SB 4 必须用 sql-springboot4-starter -->
<dependency>
    <groupId>com.easy-query</groupId>
    <artifactId>sql-springboot4-starter</artifactId>
    <version>3.2.12</version>
</dependency>
<!-- 编译期 APT（生成 Proxy 类） -->
<dependency>
    <groupId>com.easy-query</groupId>
    <artifactId>sql-processor</artifactId>
    <version>3.2.12</version>
    <scope>provided</scope>
</dependency>
<!-- MySQL 方言 -->
<dependency>
    <groupId>com.easy-query</groupId>
    <artifactId>sql-mysql</artifactId>
    <version>3.2.12</version>
</dependency>
<!-- MySQL 驱动：runtime scope 必须在 api 模块（或 infra，不能是 provided），
     否则 Hikari 抛 "Cannot load driver class: com.mysql.cj.jdbc.Driver" -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>9.2.0</version>
</dependency>
```

## 4. 实体规范

```java
@Data
@Table("sys_user")
@EntityProxy
public class SysUser implements ProxyEntityAvailable<SysUser, SysUserProxy> {

    @Column(primaryKey = true)
    private Long id;

    private String username;
    // ...
}
```

- **Easy-Query 3.2.x 中 `ProxyEntityAvailable` 是 marker 接口**（无方法），不需要 `proxyTableClass()` override（老版本有）
- 主键策略：项目内统一 `Long` 自增；非特殊需求不混用 `String`/`UUID`
- 时间字段：`createTime` / `updateTime` 用 `LocalDateTime`（**不用** `Date`）
- 软删：本版本**不**做（Q5 决策），未来需要时引入 `@LogicDelete`

## 5. Repository 规范

- **不**用 Spring Data 接口
- 直接注入 `EasyEntityQuery`（基于 entity）或 `EasyProxyQuery`（基于 proxy）
- 命名：`XxxRepository`，包路径 `service.<domain>.repository`
- 方法返回 entity，DTO 转换在 Service 层做

```java
@Component
@RequiredArgsConstructor
public class SysUserRepository {
    private final EasyEntityQuery easyEntityQuery;

    public SysUser findByUsername(String username) {
        return easyEntityQuery.queryable(SysUser.class)
                .where(u -> u.username().eq(username))
                .firstOrNull();
    }
}
```

## 6. application.yml 最小配置

```yaml
easy-query:
  enable: true
  database: mysql
  # ⚠️ 命名转换：underlined → entity 字段 userId 自动映射列 user_id
  name-conversion: underlined
  defaultDataSourceMergePoolSize: 16
```

---

## 7. 表命名约定（**部分对齐** v5）

| 维度     | 约定                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| 表名     | `sys_user`（小写下划线，**项目内**；v5 推荐 `t_<module>_<entity>`，本期 MVP 不加 `t_` 前缀） |
| 主键     | `BIGINT UNSIGNED AUTO_INCREMENT`（DB），`Long`（Java）                                       |
| 业务字段 | `snake_case`                                                                                 |
| 时间字段 | `create_time` / `update_time` 用 `DATETIME`（**不**用 `TIMESTAMP**——2038 年问题**）          |
| 字符集   | `utf8mb4` / 排序规则 `utf8mb4_0900_ai_ci`                                                    |
| 引擎     | `InnoDB`                                                                                     |
| 唯一索引 | `uniq_<table>_<col>`（如 `uniq_sys_user_username`）                                          |

完整 v5 约定：`backend/db/docs/db-conventions.md`（go-admin 项目维护，本项目**部分对齐**——不加 `deleted_at` / `is_enabled` / 7 字段审计）。

---

## 8. 常见错误（防回归）

| 错误                                                    | 现象                                                                  | 规避                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 在 SB 4 下用 `sql-springboot-starter`                   | 启动 `NoClassDefFoundError` 或行为异常                                | 必须用 `sql-springboot4-starter`                                        |
| 实体未加 `@EntityProxy` 也没实现 `ProxyEntityAvailable` | APT 报错或运行期 `ClassCastException`                                 | 3.2.x：两个都加（接口是 marker）                                        |
| `name-conversion` 没设                                  | 列名带驼峰，查询 0 结果                                               | 显式设 `underlined`                                                     |
| 业务 `@Transactional` 与 Flyway 同事务                  | 初始化失败回滚                                                        | 加 `defer-datasource-initialization: true` 或用 `FlywayMigrator` 手工跑 |
| **MySQL 驱动在 `provided` scope**                       | 启动时 Hikari 抛 `Cannot load driver class: com.mysql.cj.jdbc.Driver` | api 模块必须有 `mysql-connector-j` **runtime**（不是 provided）         |
| 混淆 `EasyEntityQuery` 与 `EasyProxyQuery`              | 类型签名错乱                                                          | 实体仓库用前者，复杂投影用后者                                          |
| Easy-Query `setUsername` API 不存在                     | `NoSuchMethodError`                                                   | Redisson 3.x 与 Easy-Query 3.2.x 错配；锁 `redisson:4.5.0+`             |

---

## 9. Flyway 迁移（**不走自动装配**）

详见 `infra-flyway.md`。要点：

- **不要**靠 `spring-boot-autoconfigure` 的 Flyway auto-config（**SB 4 下不触发**）
- 写 `FlywayMigrator implements ApplicationRunner` 手工 `Flyway.migrate()`
- profile 区分 location：`dev` 用 `classpath:db/migration`（含 V1 + V2），`prod` 用 `classpath:db/migration-prod`（**不含** V2 种子）

---

**本文件由 AI 在 2026-06-14 任务 `06-14-java-admin-backend` 中首次落盘；多次迭代后定稿。**
**AI 后续写代码前必须先读本文件，并在 `implement.jsonl` 中登记。**
