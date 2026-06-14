# Journal - wshake (Part 1)

> AI development session journal
> Started: 2026-06-14

---

## Session 1: schema v5: 字段精简与日志表扩充(对齐 PG 风格)

**Date**: 2026-06-14
**Task**: schema v5: 字段精简与日志表扩充(对齐 PG 风格)
**Branch**: `feat/admin-db-design`

### Summary

admin db schema 升级 v4→v5: sys_user 移除 dept_id、4 张表移除 description、api_log + login_log 字段对齐 PG 风格、3 份 docs 同步。回顾性建任务 + 写 prd/design/implement,无应用层代码改动。

### Main Changes

(Add details)

### Git Commits

| Hash      | Message       |
| --------- | ------------- |
| `1387021` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 2: java-admin-backend: Spring Boot 4 基础架构 + Phase 3 收尾

**Date**: 2026-06-14
**Task**: java-admin-backend: Spring Boot 4 基础架构 + Phase 3 收尾
**Branch**: `master`

### Summary

Spring Boot 4.0.3 + Java 17 + 4 模块 Maven + 40 单测绿 + 8 份规范 + e2e 全通

### Main Changes

java-admin-backend Phase 3 收尾。Spring Boot 4.0.3 + Java 17 + 4 模块 Maven（com.wshake.{common,service,infra,api}）+ 4000 段端口。栈定稿：Sa-Token 1.45.0（spring-boot4-starter + redis-template，**不用** sa-token-redisson）、Easy-Query 3.2.12（sql-springboot4-starter）、Redisson 4.5.0（V4 + autoconfigure exclude V2）、Flyway 10.20.0（手动 FlywayMigrator 走 profile 隔离）、Nacos 0.2.2+ starter（@ConfigurationProperties 绑定 enabled）、Knife4j 4.5+ jakarta、Logback（%clr 显式 ColorConverter + profile 内 appender）。40 单测 0 failure；e2e login→info→logout 全通，无 token info→401。8 份规范落盘（directory-structure/database/error-handling/logging/quality/infra-{flyway,docker-compose,nacos}），记录 11+ 个 SB 4 启动坑与 13 个业务决策（Q1-Q13）。dev profile 默认关 Nacos；prod 走环境变量；admin/admin123 仅 dev 注入（V2），prod 零种子。Docker Compose: MySQL 8.4 + Redis 7-alpine + Nacos 2.4.3 + Adminer，端口 4336/4379/4848/5848/4081。traceId 链路：Filter + MDC + 响应头 X-Trace-Id，body 严格 3 字段。

### Git Commits

| Hash      | Message       |
| --------- | ------------- |
| `d442a88` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 3: 集成 Spotless + palantir-java-format + Checkstyle

**Date**: 2026-06-15
**Task**: 集成 Spotless + palantir-java-format + Checkstyle
**Branch**: `chore/spotless-palantir-format`

### Summary

为 backend/java-admin 接入两个互补的 Java 工具链：Spotless（palantir-java-format 2.92.0）自动格式化，Checkstyle（Palantir Baseline 3.6.0）静态检查。父 POM 注册两个插件（spotless 全模块生效，checkstyle 绑 verify phase + severity=error + propertyExpansion 注入 config_loc + sourceDirectories 排除 APT 输出），新增 build-tools/checkstyle/ 目录统一规则集与基线屏蔽，lefthook.yml 加 pre-commit spotless (apply + stage_fixed) + pre-push checkstyle (check) 与现有 vp staged 并存。提交策略两段：先 chore: apply palantir-java-format（21 个 Java 文件格式化），再 chore(build): integrate 工具链 + spec 同步。Phase 3.1 trellis-check 9 个质量门全通过，0 回归。

### Main Changes

(Add details)

### Git Commits

| Hash      | Message       |
| --------- | ------------- |
| `fdca6fc` | (see git log) |
| `a640ba1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session 2: 集成 Error Prone 2.50.0 到 Java 后端构建

**Date**: 2026-06-15
**Task**: `.trellis/tasks/06-15-integrate-error-prone/`(Phase 3 收口,finish-work 收尾)

### 本次做了什么

- **JDK 21 升级**:`brew install openjdk@21` + `~/.zshrc` + `~/.zshenv` 切默认,本机 `mvn --version` Java 21.0.11。Task 1 选 B 路径的落地。
- **EP 2.50.0 集成**(`backend/java-admin/pom.xml` 4 处 + 新 `.mvn/jvm.config` + `lefthook.yml` pre-push job):
  - `maven-compiler-plugin 3.11.0` + `fork=true`(EP 官方 install guide 用的版本)
  - `<annotationProcessorPaths>` 放 lombok + sql-processor + 5 个 EP path,MCP 自动拉 transitive
  - 项目 `<dependencies>(provided)` 同步放 3 个 EP core jar(让 ServiceLoader 从 javac `-classpath` 找 plugin 类)
  - `<compilerArgs>` 含 10 个 `-J--add-exports` + 2 个 `-J--add-opens` + 3 个 EP 强制旗标 + `-Xplugin:ErrorProne`
  - `.mvn/jvm.config` 兜底(10 add-exports + 2 add-opens),应对 MCP 透传 -J 旗标的边界场景
- **spec 翻转**:`quality-guidelines.md` 第 1 节改成"三层门禁",加 8.6 节,补 4 条 EP 已知坑到第 9 节,第 10 节删 Error Prone 行。
- **修一个 test bug**:`TraceIdFilterTest.java:44` 的 `verify(chain);` 是无意义的 Mockito 调用(EP 抓出来当 ERROR),删掉(死代码清理,不改测试意图)。
- **删 errorprone.xml**:`-XepOpt:Configuration=...` 旗标在 EP 2.50.0 javac plugin 里没被消费。
- **基线**:7 个 EP warnings(5× `UnrecognisedJavadocTag` 在手写代码 + 2× `EmptyBlockTag`/`InvalidBlockTag` 在 Easy-Query APT 生成的 `SysUserProxy.java`)。

### 关键工程教训

- **EP 集成到 MCP 3.x fork 模式的核心**: `error_prone_core` 必须**同时**放 `<annotationProcessorPaths>` + project `<dependencies>(provided)`,前者拉 transitive 到 processorpath 让 plugin 加载所需类齐全,后者让 ServiceLoader 从 javac `-classpath` 找到 `ErrorProneJavacPlugin` 类。
- **EP 2.50.0 在 JDK 21 上**有几个强制旗标:`-XDcompilePolicy=simple` / `--should-stop=ifError=FLOW` / `-XDaddTypeAnnotationsToSymbol=true`,任一缺失就抛 `InvalidCommandLineOptionException`。
- **EP 2.50.0 已知缺陷**:`-Xep:CheckName:LEVEL` / `-XepOpt:Configuration=...` 旗标在 javac plugin 里没被消费(应被 plugin 截获,实际透传给 javac 报"无效的标记")。Phase 2 之前没法用 XML 配置文件。
- **JDK 升级路径**:EP 2.43.0+ 切到 JDK 21 编译(class 65.0),JDK 17 上回退到 EP 2.42.0(末班兼容版)。
- **MCP 版本选择**:EP 官方 install guide 显式说用 `3.11.0`。3.14.1 有不同的 classpath 转发行为,实际会让 `-J--add-exports` 失效。

### Git 改动

| 文件                                                                                            | 状态 | 改动                                                                       |
| ----------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `backend/java-admin/pom.xml`                                                                    | M    | 父 POM 加 EP 集成(3 处:property / project deps / maven-compiler-plugin 段) |
| `backend/java-admin/.mvn/jvm.config`                                                            | A    | 新建(10 add-exports + 2 add-opens)                                         |
| `backend/java-admin/java-admin-infra/src/test/java/com/wshake/infra/log/TraceIdFilterTest.java` | M    | 删死代码 `verify(chain);`                                                  |
| `lefthook.yml`                                                                                  | M    | pre-push 加 java-errorprone job                                            |
| `.trellis/spec/backend/quality-guidelines.md`                                                   | M    | spec 翻转 + 新 8.6 节 + 4 条 EP 坑                                         |
| `.trellis/tasks/06-15-integrate-error-prone/warn-report.txt`                                    | A    | EP 基线                                                                    |

### Testing

- [OK] `mvn -B -DskipTests -f backend/java-admin/pom.xml clean compile` → 7 warnings
- [OK] `mvn -B -f backend/java-admin/pom.xml clean verify`(4 子模块 + tests + checkstyle + spotless) → BUILD SUCCESS,24.3s
- [OK] AC 1-10 全部通过

### Status

[OK] **Completed** (本任务 in_progress,等用户决定 commit + finish-work)

### Next Steps

- 跑 trellis-check 验证
- 用户决策:commit 当前改动 + `task.py finish` + `task.py archive`
- 后续:下个任务分批收敛 7 个 EP warnings(独立 PRD 写)
