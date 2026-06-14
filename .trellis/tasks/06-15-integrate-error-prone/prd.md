# 集成 Error Prone 到 Java 后端构建

> **你(AI)正在执行这个任务,开发者不会直接阅读这个文件。**
> 通过 `prd.md` / `design.md` / `implement.md` 锁定需求、设计与执行计划,再进入实现。

---

## 1. 目标与用户价值

**目标**:把 Google Error Prone(2.x 最新稳定版)挂到 `backend/java-admin/` 多模块 Maven 构建上,在 `mvn compile` 阶段对全部手写 Java 源码跑一组高置信度静态检查,作为继 Spotless(格式)+ Checkstyle(命名/复杂度/规约)之后的**第三层质量门禁**(专注于 bug 类缺陷与正确性)。

**用户价值**:

- 在 IDE/命令行/lefthook 同一时间点暴露常见 Java bug(空指针、错误 equals、错误的 Optional 用法、错误的 `ConcurrentHashMap` 用法、不可变对象的突变等),无需等到运行时或 code review。
- 与现有 Spotless + Checkstyle 形成清晰分层:Spotless 管格式、Checkstyle 管风格/复杂度、Error Prone 管**正确性**。
- 为后续 `mvn verify` 增加 ERROR 级门禁留下可平滑过渡的通道。

---

## 2. 已确认事实(来自仓库证据)

### 2.1 项目结构(2026-06-15 状态)

- 工作根: `backend/java-admin/`,Maven 多模块 reactor。
- 父 POM: `com.wshake:java-admin-parent:0.0.1-SNAPSHOT`,`<packaging>pom`。
- Spring Boot 父 POM: `4.0.7`,Java toolchain = 17。
- 4 个子模块:
  - `java-admin-common` —— 基础库(Result/Exception/Constant/Util),无业务依赖
  - `java-admin-service` —— 业务层,依赖 Easy-Query + sa-token-core
  - `java-admin-infra` —— 基础设施(配置/Web/Logback/Nacos/Sa-Token/Redisson),依赖 service + common
  - `java-admin-api` —— 应用入口(Controller/Application 主类),依赖 infra
- 子模块自带的 `<build>` 块:
  - `java-admin-common`: 无
  - `java-admin-service`: 无
  - `java-admin-infra`: 无
  - `java-admin-api`: 有 `<finalName>` + `spring-boot-maven-plugin` repackage
- 现有 Java 源文件: **37 个** (基于 `find ... -name '*.java' | wc -l`)

### 2.2 现有 Java 工具链(2026-06-14 集成,先例)

父 POM `<build><plugins>` 已有:

- `com.diffplug.spotless:spotless-maven-plugin:3.6.0` —— palantir-java-format 自动格式化
- `org.apache.maven.plugins:maven-checkstyle-plugin:3.6.0` —— Palantir Baseline 规则集
  - 规则集路径: `${maven.multiModuleProjectDirectory}/build-tools/checkstyle/`
  - 现有 4 模块用 `checkstyle-suppressions.xml` 做基线屏蔽
  - `<sourceDirectories>` 限定 `src/main/java`,**排除** `target/generated-sources/`
  - `<testSourceDirectories>` 限定 `src/test/java`
  - 绑 `verify` phase,severity = error,failOnViolation = true
  - `propertyExpansion` 注入 `config_loc=...` 让 Palantir 的 `SuppressionFilter` 在 reactor 下找到 suppressions

父 POM `pluginManagement` 已有:

- `maven-compiler-plugin` 配置 `<annotationProcessorPaths>` 包含:
  - `org.projectlombok:lombok:${lombok.version}` (1.18.38)
  - `com.easy-query:sql-processor:${easy-query.version}` (Easy-Query APT)

### 2.3 lefthook 钩子(2026-06-14 接好)

- `pre-commit` → `mvn spotless:apply && git add`(格式化 + 重新 stage)
- `pre-push` → `mvn checkstyle:check`(快速 feedback,fast fail)

### 2.4 spec 现状(2026-06-14 定稿)

- `.trellis/spec/backend/quality-guidelines.md` 第 1 节明确写:
  > **不**集成 SpotBugs / Error Prone(本期范围外)。
- 第 10 节"不在范围内":
  > ❌ SpotBugs / Error Prone(静态分析工具仅留 Checkstyle)
- **本任务将翻转这条决策**,spec 必须同步更新。

### 2.5 当前已知的兼容性陷阱

- **Lombok + Error Prone** 长期存在 javac 编译顺序问题:
  - Lombok 在 javac AST 上做修改,Error Prone 在编译期检查 AST。
  - 标准解决:`errorprone` 的 javac plugin 通过 `-Xplugin:ErrorProne` 启用,放在 `compilerArgs` 里;`lombok` 在 `annotationProcessorPaths` 第一个位置;`errorprone_annotations` 紧随其后(让 Lombok 不把 `@CanIgnoreReturnValue` 等注解认为是它自己生成的)。
  - Lombok 1.18.30+ 已修复大多数冲突;项目当前 Lombok 1.18.38,理论上 OK 但需实测。
- **Easy-Query APT 生成的代码** 在 `target/generated-sources/`,需要在 Error Prone 里跳过(同 Checkstyle 现已排除的策略)。
- **JDK 17 + Error Prone 3.x 不兼容**(3.x 要求 JDK 21+),因此锁定 2.x。

### 2.6 工具链/环境

- `mvn --version` 当前报 `JAVA_HOME not defined correctly` —— 命令行工具存在但环境未正确配置;执行阶段需先修。
- `java -version` 报 `OpenJDK 17.0.19 (Homebrew)` —— JDK 17 已装。

---

## 3. 需求

### 3.1 功能性需求

- **F1** 父 POM 引入 Error Prone 2.x 最新稳定版,作为 `maven-compiler-plugin` 的 javac plugin 与 annotation processor,所有 4 个子模块自动继承。
- **F2** 运行 `mvn compile` / `mvn test-compile` 时,Error Prone 对全部手写 Java 源码(包含 main + test)做静态检查。
- **F3** 检查级别 = **Default**(开箱即用的高置信度 bug 检查)。
- **F4** 默认所有 Default 检查以 **WARN** 级别出现在编译输出,**不**让 `mvn compile` 直接失败。
- **F5** 提供禁用个别检查的机制(可参考 Checkstyle 的 suppressions 模式),用于处理:
  - Easy-Query APT 生成的代码
  - 现有 37 个文件中暂未修的真实违规(分批收敛)
- **F6** 文档(spec + 注释)明确:**WARN → ERROR 切换路径** 写在 implement.md 里,作为第二阶段任务。
- **F7** spec 同步更新(`.trellis/spec/backend/quality-guidelines.md` 翻转"不集成 Error Prone"决策,补全新章节)。
- **F8** 验证闸门:`mvn compile` 跑通、无 ERROR、Warning 数量落盘记录到任务产物中。

### 3.2 非功能性需求

- **N1** 性能:`mvn clean compile` 增加时间 < 30%(在 37 个文件规模下基本是噪声)。
- **N2** 与现有工具的职责分层不破坏(Spotless 管格式、Checkstyle 管风格、Error Prone 管正确性)。
- **N3** 不引入新依赖到子模块的 `dependencies`(只在父 POM 的 `pluginManagement` 与 `build.plugins` 维护)。
- **N4** 切换到 Error Prone 2.x 时不要求升级 Java toolchain(保持 JDK 17)。

---

## 4. 验收标准(可测试)

| ID    | 标准                                                                                                                                                                                                              | 验证方式                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| AC-1  | 父 POM 显式声明 `error_prone_core` / `error_prone_annotations` 版本属性为 **`<errorprone.version>2.50.0</errorprone.version>`**(2026-06-10 发布,2.x 最新,需 JDK 21+;2.42.0 是末班 JDK 17 兼容版,3.x 需 JDK 21+)   | `grep errorprone.version pom.xml`             |
| AC-2  | `maven-compiler-plugin` 的 `<annotationProcessorPaths>` 包含 `error_prone_core`(或等价 jvm-arg 方式),并保证 lombok 在 EP 之前                                                                                     | 人工检查 POM 顺序                             |
| AC-3  | `maven-compiler-plugin` 的 `<compilerArgs>` 包含 `-Xplugin:ErrorProne`,并附带 `-XepDisableWarningsInGeneratedCode`(或等价手段)排除 APT 生成代码                                                                   | 人工检查 POM                                  |
| AC-4  | 在 `java-admin-common` / `java-admin-service` / `java-admin-infra` / `java-admin-api` 中各放一行故意违例(如 `String x = null; return x.length();` 触发 `NullPointerException` 检查),`mvn compile` 仍然 **exit 0** | `mvn -q -DskipTests compile`                  |
| AC-5  | `mvn -X compile` 日志中可见 `com.google.errorprone` 加载;`mvn clean compile` 日志中能看到 Error Prone 警告输出                                                                                                    | `mvn -X compile 2>&1 \| grep errorprone`      |
| AC-6  | `mvn verify` 不被 Error Prone 阻断(severity = WARN,不 fail)                                                                                                                                                       | `mvn -q -DskipTests verify`                   |
| AC-7  | 4 个子模块继承父 POM 后无需在自身 POM 加任何 Error Prone 配置                                                                                                                                                     | `git diff` 4 个子模块 POM 应为空              |
| AC-8  | `.trellis/spec/backend/quality-guidelines.md` 已更新:翻转第 1 节的"不集成"决策、新增 Error Prone 章节、第 8.5 节增加 Error Prone 验收项、第 10 节从"不在范围内"删除 Error Prone                                   | `git diff spec/...`                           |
| AC-9  | 父 POM 改动后,`mvn spotless:check`(格式)与 `mvn checkstyle:check`(Checkstyle)两条命令仍独立可用,不因 Error Prone 集成而坏                                                                                         | `mvn spotless:check` + `mvn checkstyle:check` |
| AC-10 | 任务产物中保存一份"首次 WARN 完整清单"(Warning 总数、按 check 分类的 Top-N)                                                                                                                                       | `implement.md` 附录或独立 `wran-report.txt`   |

---

## 5. 范围外

- ❌ 不集成 Error Prone 3.x(锁定 2.x;3.x 需 JDK 21)。
- ❌ 不集成 SpotBugs、NullAway、Checker Framework(本期仅 Error Prone)。
- ❌ 不在 `mvn verify` 把 Error Prone 提升为 ERROR 门禁(留到第二阶段任务,本任务只做 WARN 落地 + 清单收集)。
- ❌ 不修改 37 个现有 `.java` 文件来消除 Warning(分批收敛是后续工作,本期只收基线清单)。
- ❌ 不调整 JDK toolchain(保持 17)。
- ❌ 不动前端 monorepo(pnpm/Vite+ 部分)与 lefthook 的非 Java 钩子。
- ❌ 不集成 IDE(`.idea/`、`.vscode/`)插件的 Error Prone 显式配置(交由 IDE 自行发现;本期只管 build 行为)。

---

## 6. 已知风险(待规划阶段细化)

| 风险                                                                | 影响                                                                      | 缓解                                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Lombok 1.18.38 与 Error Prone 2.41.x 在 javac 19/20 上可能崩溃      | `mvn compile` 直接挂掉                                                    | 1) 试 `2.41.0` + `-XepDisableWarningsInGeneratedCode`;2) 必要时降级到 EP 2.36.0;3) 备选:禁用个别冲突的 checker(如 `ImmutableSetForIterator`)   |
| Easy-Query APT 生成的代码触发 Error Prone 警告                      | 大量噪声干扰收敛                                                          | 用 `-XepDisableWarningsInGeneratedCode` 排除;或 `<compilerArgs>` 配 `-XepDisableAllChecks -Xep:NullChecker:WARN` 逐个启用                      |
| 现有 37 个文件的 Warning 数量巨大,基线清单收集耗时                  | 验收时间被拉长                                                            | 不修任何文件,只跑 `mvn compile`,把 stderr 写到任务产物的 `warn-report.txt`;按 check name `awk` 统计 Top-N                                      |
| `JAVA_HOME` 未配置导致 mvn 报 env 错                                | 无法在本地验证                                                            | 执行阶段第一步解决:在 `~/.mavenrc` 或 `Makefile` 中注入 `JAVA_HOME=$(brew --prefix openjdk@17)`                                                |
| 子模块 `java-admin-api` 自带 `<build>` 块(spring-boot-maven-plugin) | 父 POM 在 `<build><plugins>` 加 Error Prone 时,需确认子模块不会"覆盖"配置 | 把 EP 配置放在父 POM `<build><plugins>`(不是 `pluginManagement`),让子模块用 `inherited` 机制继承;或使用 `pluginManagement` + 子模块显式 enable |
| Spring Boot 4 + Hibernate Validator 等常用类触发 EP 误报            | 不修 Spring 依赖源码,但本项目自己代码用到的 API 可能误报                  | 列出 EP 常见误报清单(`ImmutableSetForIterator`、`ModifySourceCollectionInUnmodifiableContext` 等),集成时一并 `-Xep:...:OFF`                    |

---

## 7. 已确认/待确认的产品/范围决策

### 7.1 已确认

1. **配置文件组织**: ✅ **外置 `errorprone.xml` + `errorprone-suppressions.xml`**(与 Checkstyle 保持一致)
   - 路径: `backend/java-admin/build-tools/errorprone/`
   - 文件:
     - `errorprone.xml` —— Error Prone 主配置(检查级别 + check 列表覆盖)
     - `errorprone-suppressions.xml` —— 现有 37 文件的基线屏蔽
   - 父 POM `<compilerArgs>` 用 `-Xplugin:ErrorProne` + `-XepDisableWarningsInGeneratedCode` 引用

2. **构建模式**: ✅ **always-on,severity = WARN**。`mvn compile` 必须加载 Error Prone,违规以 WARN 出现,不阻断 build。**不**做 profile 模式。

3. **lefthook 钩子**: ✅ **加 pre-push 钩子 `java-errorprone`**,与现有 `java-checkstyle` 并行。
   - 命令: `mvn -q -DskipTests compile 2>&1 | grep -E '\[ERROR\]|warning:'`(只看新增/回归的 EP warning)
   - 与 `java-checkstyle` 同一 pre-push stage,parallel 跑
   - `LEFTHOOK=0` 仍可绕过

### 7.2 待确认(已全部确认)

4. **`.trellis/spec/backend/quality-guidelines.md` 更新粒度**: ✅ **(C) 完整更新**
   - 第 1 节翻转"不集成"决策,描述 Error Prone 角色(正确性门禁,与 Spotless/Checkstyle 互补)
   - 第 10 节"不在范围内"删除 Error Prone
   - 新增 **8.6 Error Prone 验收小节**(配置位置、版本、启用命令、lefthook 钩子、AC 列表)
   - 第 9 节"常见错误"表追加 3-4 条 EP 已知坑:
     - Lombok 1.18.30+ 与 EP 2.x 的 javac 顺序与兼容性
     - APT 生成代码必须用 `-XepDisableWarningsInGeneratedCode` 跳过
     - 父 POM `<build><plugins>` 继承:子模块 `<build>` 块需 `inherited` 确认
     - 常见误报清单(`ImmutableSetForIterator`、`ModifySourceCollectionInUnmodifiableContext` 等)与 `-Xep:...:OFF` 禁用方法

5. **现有 37 个文件 Warning 处理**: ✅ **本任务仅"基线 + 文档化"收口**,不分批修复。
   - 验收时跑一次 `mvn -DskipTests compile`,把 stderr 写到任务产物 `warn-report.txt`
   - 用 `awk`/`grep` 提取按 check 名分类的 Top-N 摘要,写进 `prd.md` 附录
   - 下个任务另立,PRD 独立写

---

**PRD 状态**: ⛔ **BLOCKED — build 跑不通**,详见本文 §8。

> 开发策略 / 审查闸门 / 验证清单:见同目录 `implement.md`(已 stamp `Review-gate contract: explicit-selection-v1`)。
> 技术设计 / 兼容性 / 回滚:见同目录 `design.md`。

---

## 8. ⛔→🟡→✅ 阻塞完整解锁(2026-06-15 01:33+)

### 8.0 用户选定解锁路径:选项 C(EP 官方 install guide 推荐写法)

参照 https://errorprone.info/docs/installation 的官方推荐配置,关键发现是:

- **`-J--add-exports` 旗标在 MCP 3.x 的 fork 模式下有兼容性问题**——直接放 `<compilerArgs>` 会被吞,但能工作
- **核心:把 `error_prone_core` 等 EP jars 同时放 project `<dependencies>`(provided)+ `<annotationProcessorPaths>`**:
  - `<annotationProcessorPaths>` 让 MCP 自动拉 transitive(Guava、protobuf、dataflow 等)到 processorpath,让 EP plugin 加载时所需类齐全
  - project `<dependencies>(provided)` 让 ServiceLoader 从 javac `-classpath` 找到 `ErrorProneJavacPlugin` 类本身
- **MCP 版本锁 3.11.0**(EP 官方 install guide 用的版本;3.14.1 有不同的 classpath 转发行为)
- **JDK 21 + EP 2.50.0** 是必要组合(2.43.0+ 切 JDK 21;JDK 17 + EP 2.42.0 也行)

### 8.1 环境改动(已落地)

- `brew install openjdk@21` → 21.0.11
- `~/.zshrc` + `~/.zshenv` 设 JAVA_HOME + PATH,JDK 21 切为本地默认
- `java -version` 21.0.11;`mvn --version` Java 21.0.11

### 8.2 关键配置(父 POM)

```xml
<!-- properties -->
<errorprone.version>2.50.0</errorprone.version>

<!-- project <dependencies>(provided 作用域) -->
<dependency>
  <groupId>com.google.errorprone</groupId>
  <artifactId>error_prone_core</artifactId>
  <version>${errorprone.version}</version>
  <scope>provided</scope>
</dependency>
<dependency>...check_api...</dependency>
<dependency>...annotation...</dependency>

<!-- maven-compiler-plugin (3.11.0) -->
<configuration>
  <source>${java.version}</source>
  <target>${java.version}</target>
  <fork>true</fork>
  <annotationProcessorPaths>
    <path>lombok</path>
    <path>easy-query sql-processor</path>
    <path>error_prone_annotations</path>
    <path>error_prone_core</path>
    <path>error_prone_check_api</path>
    <path>error_prone_annotation</path>
    <path>dataflow-errorprone</path>
  </annotationProcessorPaths>
  <compilerArgs>
    <arg>-J--add-exports=...</arg>  <!-- 8 个 -->
    <arg>-J--add-opens=...</arg>    <!-- 2 个 -->
    <arg>-XDcompilePolicy=simple</arg>
    <arg>--should-stop=ifError=FLOW</arg>
    <arg>-XDaddTypeAnnotationsToSymbol=true</arg>
    <arg>-Xplugin:ErrorProne</arg>
  </compilerArgs>
</configuration>

<!-- .mvn/jvm.config(10 个 add-exports + 2 个 add-opens) -->
```

### 8.3 验证结果

| 步骤                                    | 结果                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `mvn -B -DskipTests compile` (4 子模块) | ✅ BUILD SUCCESS,6.5s                                                                                               |
| EP warnings 实际输出                    | ✅ 7 个(5× UnrecognisedJavadocTag 在手写 + 2× EmptyBlockTag/InvalidBlockTag 在 Easy-Query 生成的 SysUserProxy.java) |
| 故意违例测试(`s.toLowerCase()`)         | ✅ EP 报 `[StringCaseLocaleUsage]` warning,build exit 0                                                             |
| `mvn spotless:check`                    | ✅ exit 0                                                                                                           |
| `mvn checkstyle:check`                  | ✅ exit 0                                                                                                           |
| `mvn -B -DskipTests verify` (4 子模块)  | ✅ BUILD SUCCESS                                                                                                    |

### 8.4 任务状态:✅ in_progress → 等用户决定是否 commit + finish-work

源码改动已经落到 working tree:

- `backend/java-admin/pom.xml` —— 加 EP 集成(3 处:property、project deps、maven-compiler-plugin 段)
- `backend/java-admin/.mvn/jvm.config` —— 新文件
- `lefthook.yml` —— pre-push 加 java-errorprone job
- `.trellis/spec/backend/quality-guidelines.md` —— spec 翻转
- `.trellis/tasks/06-15-integrate-error-prone/warn-report.txt` —— 基线

下一阶段可选:

1. commit 当前改动,任务归档(`task.py finish` + `task.py archive`)
2. 跑下个任务:分批收敛 7 个 EP warnings(下个 PRD)
3. 跑 trellis-check 验证质量闸门

---
