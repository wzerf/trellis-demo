# Design: 集成 Error Prone 到 Java 后端构建

> 技术设计。复杂 build-toolchain 改动,需要明确边界、契约、兼容性、回滚形态。

---

## 1. 架构与边界

### 1.1 Error Prone 在构建中的位置

```
mvn compile
  └─► maven-compiler-plugin
        ├─► javac (JDK 17)
        │     └─► -Xplugin:ErrorProne              (从 compilerArgs 注入)
        │           ├─► -XepOpt:Configuration=...  → 加载 build-tools/errorprone/errorprone.xml
        │           ├─► -XepOpt:SuppressionFiles=...→ 加载 suppressions
        │           └─► 加载 error_prone_core BugChecker
        ├─► annotationProcessorPaths(顺序敏感)
        │     ├─► lombok (1.18.38)                —— 必须先于 errorprone
        │     ├─► Easy-Query sql-processor (3.2.12)
        │     └─► error_prone_annotations (2.50.0)—— 让 @CanIgnoreReturnValue 等注解被 javac 识别
        └─► source/target = 17
```

### 1.2 配置物理布局

```
backend/java-admin/
├── pom.xml                                       # 父 POM:新增 <plugin> + <property>
├── build-tools/
│   ├── checkstyle/                               # 已有 (2026-06-14)
│   └── errorprone/                               # 新增 (本任务)
│       ├── errorprone.xml                        # 检查级别、check 列表覆盖
│       └── errorprone-suppressions.xml           # 现有 4 模块基线屏蔽
├── java-admin-common/pom.xml                     # 不动
├── java-admin-service/pom.xml                    # 不动
├── java-admin-infra/pom.xml                      # 不动
└── java-admin-api/pom.xml                        # 不动(继承父 POM)
```

### 1.3 范围边界

| 边界                                                      | in / out                               |
| --------------------------------------------------------- | -------------------------------------- |
| 父 POM `<properties>` 新增 `<errorprone.version>`         | ✅ in                                  |
| 父 POM `<build><plugins>` 升级 `maven-compiler-plugin` 段 | ✅ in                                  |
| 父 POM `<pluginManagement>` 现有 lombok/sql-processor 段  | ⏸️ 保持原状(避免破坏子模块继承)        |
| 子模块 pom.xml(4 个)                                      | ❌ 全部不动                            |
| 现有 37 个 .java 文件                                     | ❌ 全部不动(只跑 WARN 收基线)          |
| Spotless 3.6.0 配置                                       | ❌ 不动                                |
| Checkstyle Palantir Baseline 配置                         | ❌ 不动                                |
| lefthook.yml                                              | ✅ 加 pre-push.java-errorprone         |
| `.trellis/spec/backend/quality-guidelines.md`             | ✅ 改(翻转决策 + 8.6 节 + 9 节)        |
| `.trellis/spec/backend/index.md`                          | ❌ 不动(已存在的 spec 文件,无新增文件) |

---

## 2. 数据流与契约

### 2.1 Error Prone 主配置 `errorprone.xml`

参考 Google 官方 DTD(`com.google.errorprone.ErrorProneOptions`)。骨架:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ErrorProne version="2.50.0">
  <BugPattern>
    <Disable>
      <!-- "请使用 ImmutableList.copyOf()":流式 API 场景下常误报 -->
      <Name>ImmutableSetForIterator</Name>
      <!-- 静态不可变集合的 add/remove:不必要约束 -->
      <Name>ModifySourceCollectionInUnmodifiableContext</Name>
      <!-- Stream + Optional 链常见的接口内 lambda 副作用误报 -->
      <Name>UnnecessaryLambda</Name>
    </Disable>
  </BugPattern>
  <Severity>
    <DefaultSeverity>WARN</DefaultSeverity>
  </Severity>
</ErrorProne>
```

> 检查级别 = Default 等价于不显式开启 set;为团队可读性,显式写空 `<BugPattern/>`。
> 严重度 WARN 不阻断 `mvn compile`。**不**在此阶段把任何 check 提为 ERROR。

### 2.2 抑制清单 `errorprone-suppressions.xml`

> ⚠️ **重要**:Error Prone 2.50.0 **不**内置读 XML suppressions 的 filter(`XepOpt:SuppressionFiles=` 在 2.x 中并不是原生支持的选项)。本设计采用务实方案:

**方案 A(优先,推荐)**:把当前不希望被检查的代码段用 **`@SuppressWarnings("CheckName")`** 标注在源代码上。Phase 1 不修任何 .java,所以**先不写 suppressions 文件**,改为在 `errorprone.xml` 中通过 `<Severity><BugPatternInstance>` 给历史违规的 check 显式降级为 OFF。

**方案 B(fallback)**:在 `build-tools/errorprone/` 下放一个 `errorprone-suppressions.xml`,但其作用是**给未来 Phase 2 分批修时的"分阶段降级"留位**;Phase 1 内容为空或仅文档注释。

**方案 C(fallback-2)**:写一个自定义 `BugChecker` 用 javac plugin API 读 XML 后调 `state.reportMatch()` 抑制 —— 工程量最大,放弃。

> **本任务采用方案 A**:`errorprone.xml` 显式关 3 个已知高噪音 check(`ImmutableSetForIterator` / `ModifySourceCollectionInUnmodifiableContext` / `UnnecessaryLambda`);**不创建** `errorprone-suppressions.xml`。下个任务分批修时,如发现特定文件级违规需要粒度更细的抑制,改用方案 B 创建 `errorprone-suppressions.xml` 并对接自定义 checker。

### 2.3 父 POM 改动契约

在 `<build><plugins>` 内,**复制**现有 `maven-compiler-plugin` 块并增强(参考当前根 pom:161-181):

```xml
<!--
  Error Prone 2.50.0:Java 静态分析(bug 检测)
  默认 Default level + WARN severity,不阻断 mvn compile;
  与 Spotless(格式) / Checkstyle(风格) 形成三层门禁。
  配置外置于 ${maven.multiModuleProjectDirectory}/build-tools/errorprone/
-->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <source>${java.version}</source>
    <target>${java.version}</target>
    <annotationProcessorPaths>
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>${lombok.version}</version>
      </path>
      <path>
        <groupId>com.easy-query</groupId>
        <artifactId>sql-processor</artifactId>
        <version>${easy-query.version}</version>
      </path>
      <!-- Error Prone 注解支持:让 @CanIgnoreReturnValue 等 EP 注解在 javac 中可被识别 -->
      <path>
        <groupId>com.google.errorprone</groupId>
        <artifactId>error_prone_annotations</artifactId>
        <version>${errorprone.version}</version>
      </path>
    </annotationProcessorPaths>
    <compilerArgs>
      <!-- 启用 Error Prone javac plugin -->
      <arg>-Xplugin:ErrorProne</arg>
      <!--
        EP 默认会把 .class 文件里 @Generated 标记的代码视为"generated"并跳过 Warning。
        Lombok 1.18.30+ 已自动给生成代码加 @Generated;Easy-Query sql-processor
        的输出可能未加,需配 XepDisableWarningsInGeneratedCode 一并跳过。
      -->
      <arg>-XepDisableWarningsInGeneratedCode</arg>
      <!-- 指定 errorprone.xml 路径 -->
      <arg>-XepOpt:Configuration=${maven.multiModuleProjectDirectory}/build-tools/errorprone/errorprone.xml</arg>
    </compilerArgs>
  </configuration>
</plugin>
```

> **关键**:把现有位于 `pluginManagement` 的 `maven-compiler-plugin` 配置 **复制一份**到 `<build><plugins>`(Spotless/Checkstyle 也在这一层,保持一致)。`pluginManagement` 那段保留 lombok/sql-processor 的最小配置,作为未来"想关掉 EP 又保持 lombok 编译"的退路。

### 2.4 父 POM 还需要的新增 property

```xml
<!-- Error Prone 2.x (2026-06-15 集成;2.50.0 是 2.x 末班 JDK 17 兼容版) -->
<errorprone.version>2.50.0</errorprone.version>
```

---

## 3. 兼容性

### 3.1 工具链矩阵

| 组件                         | 版本                                            | 状态                                                                             |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| JDK(用户侧运行)              | 17 (Homebrew)                                   | ✅ Error Prone 2.50.0 用户侧支持(class 61.0);2.43.0+ class 65.0 需 JDK 21        |
| maven-compiler-plugin        | 来自 SB 4.0.7 parent                            | ✅ 父 POM 已有                                                                   |
| Lombok                       | 1.18.38                                         | ✅ 与 EP 2.x 兼容(1.18.30+ 修复 javac 顺序冲突)                                  |
| Easy-Query sql-processor     | 3.2.12                                          | ⚠️ 生成代码可能无 @Generated 标记 → 用 `-XepDisableWarningsInGeneratedCode` 兜底 |
| Spring Boot 4.0.7 parent POM | 4.0.7                                           | ✅ 不冲突                                                                        |
| 4 个子模块的 `<build>` 块    | 仅有 java-admin-api 含 spring-boot-maven-plugin | ✅ 通过 inheritance 默认继承父 plugin;子模块 `<build>` 不会被覆盖                |

### 3.2 javac 行为差异

- `mvn clean compile` 时间增加 ~5-10s(37 文件体量)
- `mvn clean verify` 增量同上(SP/CS 已有,可叠加)
- 内存:`-Xplugin:ErrorProne` 在 javac 进程中多占 ~50-100MB;37 文件规模可忽略

### 3.3 退出码

| 场景                                     | 退出码 | 备注                                         |
| ---------------------------------------- | ------ | -------------------------------------------- |
| `mvn compile` 无 warning                 | 0      | 正常                                         |
| `mvn compile` 有 WARN(本任务目标)        | 0      | WARN 不阻断                                  |
| `mvn compile` 有 ERROR(未来 ERROR 门禁)  | 1      | 由 `-Xep:<CheckName>:ERROR` 决定             |
| `mvn verify`(含 SP + CS + EP)            | 0      | 当前;ERROR 提级后此 phase 自动 fail          |
| lefthook pre-push `java-errorprone` 失败 | 1      | 阻断 push(等同于 `java-checkstyle` 现有行为) |

---

## 4. 重要权衡

| 决策                                            | 取舍                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **外置 `errorprone.xml`**(与 Checkstyle 对齐)   | ✅ 与现有项目约定一致,易维护;❌ 多一个目录要管                                                  |
| **WARN 不阻断**                                 | ✅ 现有代码不会被爆炸;❌ 短期可能"无人关心" — 通过 lefthook pre-push 强制曝光                   |
| **Phase 1 不引入 XML suppressions**(方案 A)     | ✅ 简单,跟 EP 原生能力对齐;❌ 粒度只能到 check 全局关,无法按文件 — 下个任务分批修时升级到方案 B |
| **关掉 3 个已知高噪音 check**                   | ✅ 减少误报干扰;❌ 团队失去学习机会 — 在 spec 第 9 节注释关掉的原因                             |
| **`-XepDisableWarningsInGeneratedCode` 一刀切** | ✅ 简单;❌ 偶尔会漏掉 Easy-Query 生成代码里真实的小问题;37 文件规模权衡可接受                   |
| **lefthook pre-push 加 java-errorprone job**    | ✅ 快速 feedback;❌ 每次 push 多 ~5-10s;可 `LEFTHOOK=0` 绕过                                    |
| **always-on,不做 profile 开关**                 | ✅ 行为可预测,新代码自动受检;❌ CI 与本地表现一致,无法"暂关"(只能调 severity)                   |

---

## 5. 上线 / 回滚

### 5.1 上线步骤(本任务内完成)

1. 父 POM 加 `<errorprone.version>2.50.0</errorprone.version>` property(§2.4)
2. 父 POM 在 `<build><plugins>` 复制并增强 `maven-compiler-plugin` 段(§2.3);原 `pluginManagement` 段保留最小配置
3. 新建 `build-tools/errorprone/errorprone.xml`(§2.1)
4. lefthook.yml `pre-push` 加 `java-errorprone` job
5. spec `.trellis/spec/backend/quality-guidelines.md` 完整更新(见 implement.md §2.7)
6. 跑 `mvn -B -DskipTests compile`,收集 stderr → `warn-report.txt`,写 Top-N 摘要进 prd.md 附录
7. AC 1-10 逐条验证

### 5.2 回滚步骤(如发现重大误伤)

1. 父 POM 把新增的 `error_prone_annotations` path 与 `<compilerArgs>` 里 EP 相关 arg 全部删掉
2. `build-tools/errorprone/` 整目录删除
3. `lefthook.yml` 删 `java-errorprone` job
4. `quality-guidelines.md` revert 第 1 节、第 10 节、8.6 节、第 9 节新增行
5. 跑 `mvn -B -DskipTests compile` 确认不加载 EP
6. 整体 commit `revert: error-prone integration`(可一次 commit 回滚)

回滚影响范围:**只影响 1 个父 POM、1 个新文件、1 个 lefthook、1 个 spec**。子模块、现有 37 个 .java 全部不动。

---

## 6. 风险与缓解(实施阶段必跑)

| 风险                                                        | 验证方式                                                                   | 缓解                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lombok 与 EP javac 顺序冲突导致 `mvn compile` 挂            | 跑 `mvn -X compile` 看 stderr;若抛 `IllegalAccessError` 即是               | EP 注解包放 annotationProcessorPaths 尾部;lombok 保持第一;必要时升级 Lombok 到 1.18.40+                       |
| Easy-Query APT 大量触发 EP warning                          | 跑 `mvn compile` 看 generated-sources 下文件是否被报告                     | `-XepDisableWarningsInGeneratedCode`;若仍报,改 `<sourceDirectories>` 显式排除                                 |
| `errorprone.xml` 配置不被 EP 加载                           | `mvn -X compile 2>&1 \| grep -i 'configuration'`                           | 检查 `-XepOpt:Configuration=...` 路径;`maven.multiModuleProjectDirectory` 是否解析正确                        |
| `errorprone-suppressions.xml` 抑制不生效(2.50.0 不原生支持) | 不创建(本任务方案 A)                                                       | 后续如需粒度抑制,降级为方案 B 或在源码加 `@SuppressWarnings("CheckName")`                                     |
| 子模块 `java-admin-api` 自带 `<build>` 块覆盖父 plugin      | 跑 `mvn -B -DskipTests compile`,看 `[INFO] --- maven-compiler-plugin` 日志 | 把父 plugin 整段放 `<build><plugins>`(不放在 pluginManagement),子模块会通过 inheritance 继承;不冲突时无需操作 |
| `JAVA_HOME` 未配置导致 mvn 报 env 错                        | 任何 mvn 命令                                                              | 见 implement.md §2.1 — `~/.zshrc` 加 export 或每条命令前 `JAVA_HOME=...`                                      |

---

**设计状态**: ✅ 锁定 + 验证通过(2026-06-15 01:33+)。详见 prd.md §8.4。`mvn -B -DskipTests compile` 4 子模块全过,EP 报 7 个 WARN,故意违例测试触发 `[StringCaseLocaleUsage]`,Spotless + Checkstyle + Verify 全过。

关键发现:核心是把 `error_prone_core` 等 EP jars **同时**放 `<annotationProcessorPaths>` + 项目 `<dependencies>(provided)`,前者拉 transitive 到 processorpath,后者让 ServiceLoader 从 javac `-classpath` 找到 plugin 类。详见 prd.md §8.2。
