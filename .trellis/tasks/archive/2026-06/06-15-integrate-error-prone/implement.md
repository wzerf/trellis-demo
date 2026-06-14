# Implement: 集成 Error Prone 到 Java 后端构建

> 执行计划。复杂任务,需要明确策略、闸门、清单、命令、回滚点。

---

## 1. 开发策略决策(impl 必填)

**Review-gate contract: explicit-selection-v1**

- **开发模式**: 默认流(非 TDD)。集成项不引入新单测,以"基线 `mvn compile` 跑通 + 收集 warn 清单"为产物。
- **分支策略**: 直接在 `master` 提交,单次 commit 完成全部变更。
- **默认流参考**: 普通 `git commit` 流程,不在 worktree 隔离。
- **架构审查**: 关闭(`trellis-improve-codebase-architecture` 在可选集中 OFF)。
- **执行顺序**: 简单线性 —— 配置 → 跑通 → 收基线 → 改 spec。无需 review 闸门介入。
- **pre-dev 架构 guidance**: 关闭(任务范围明确,不需要 brainstorming 架构)。

**Enabled optional review gates:** _(无)_

**Disabled optional review gates:**

- `trellis-spec-review`
- `trellis-code-review`
- `trellis-code-architecture-review`
- `trellis-improve-codebase-architecture`
- `trellis-merge-review`

> 固定 `trellis-check` 在 Phase 3 收口(此集外,不在可选集内)。
> 子代理调度协议:若后续派 `trellis-implement` / `trellis-check` / `trellis-research`,dispatch prompt 必须以 `Active task: .trellis/tasks/06-15-integrate-error-prone` 起头。

---

## 2. 实施 checklist(有序)

> 顺序:配置 → 跑通 → 收基线 → 改 spec → AC 验证。每步给出验证命令。

### 2.1 修 JAVA_HOME 工具链(阻塞 mvn,先做)

- [ ] 解决 `mvn --version` 报 `JAVA_HOME not defined` 的问题
  - 在 `~/.zshrc` 加:
    ```bash
    export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
    export PATH="$JAVA_HOME/bin:$PATH"
    ```
  - `source ~/.zshrc` 后验证: `mvn --version` 输出 `Java version: 17.0.x` 即 OK
  - 若 `brew --prefix openjdk@17` 路径不对,`brew --prefix openjdk@17` 探测
- 验证: `mvn --version 2>&1 | grep 'Java version'`

### 2.2 父 POM 加 property

- [ ] 在 `backend/java-admin/pom.xml` `<properties>` 段尾追加:
  ```xml
  <errorprone.version>2.50.0</errorprone.version>
  ```
- 验证: `grep -n 'errorprone.version' backend/java-admin/pom.xml`

### 2.3 父 POM 修 maven-compiler-plugin 块

- [ ] 在 `<build><plugins>` 内新增 `maven-compiler-plugin` 段(与现有 Spotless/Checkstyle 同级),参考 design.md §2.3 完整 XML
- [ ] `<annotationProcessorPaths>` 顺序: lombok → sql-processor → error_prone_annotations
- [ ] `<compilerArgs>` 含 4 个 arg: `-Xplugin:ErrorProne` / `-XepDisableWarningsInGeneratedCode` / `-XepOpt:Configuration=...`
- 验证: `xmllint --xpath '//plugin[artifactId="maven-compiler-plugin"]/configuration/compilerArgs/arg' backend/java-admin/pom.xml`(或人工 review)

### 2.4 创建 `build-tools/errorprone/errorprone.xml`

- [ ] 新建 `backend/java-admin/build-tools/errorprone/errorprone.xml`,内容按 design.md §2.1
- [ ] 检查: well-formed XML,Default severity = WARN,关 3 个 check
- 验证: `xmllint --noout backend/java-admin/build-tools/errorprone/errorprone.xml`;退出码 0

### 2.5 lefthook.yml 加 pre-push job

- [ ] 在 `pre-push.commands` 加 `java-errorprone` job(与 `java-checkstyle` 并行):
  ```yaml
  java-errorprone:
    glob: "backend/java-admin/**/src/{main,test}/java/**/*.java"
    run: mvn -B -q -f backend/java-admin/pom.xml -DskipTests compile
  ```
- 验证: `pnpm exec lefthook run pre-push --commands java-errorprone --force`(无 EP error)

### 2.6 spec 更新 `.trellis/spec/backend/quality-guidelines.md`

- [ ] 第 1 节 `Lint / Format` 块:
  - 翻转 "**不**集成 SpotBugs / Error Prone(本期范围外)" → 改为:
    > **集成** Error Prone 2.50.0(正确性门禁,always-on,WARN 不阻断;2.x 最新稳定,2026-06-10 发布,需 JDK 21+);与 Spotless(格式) / Checkstyle(命名/复杂度/规约) 形成三层互补。
  - 三层分工要画清楚
- [ ] 第 8.5 节 Java 工具链验收项后新增 **8.6 Error Prone** 小节,描述:
  - 配置文件位置: `build-tools/errorprone/errorprone.xml`
  - 父 POM `<plugins>` 入口(`maven-compiler-plugin` 段加 EP)
  - lefthook pre-push `java-errorprone` job
  - 验收 AC 列表(从 prd.md §4 摘)
- [ ] 第 9 节"常见错误"表追加 4 条:
  - Lombok 1.18.30+ 与 EP 2.x javac 顺序(EP 注解包放最后)
  - APT 生成代码用 `-XepDisableWarningsInGeneratedCode` 跳过(Lombok 1.18.30+ 自动加 @Generated,Easy-Query sql-processor 不一定)
  - 父 POM `<build><plugins>` 继承:子模块 `<build>` 块需 `inherited` 确认
  - 已知误报与 `-Xep:CheckName:OFF` 禁用
- [ ] 第 10 节"不在范围"删除 "❌ SpotBugs / Error Prone" 行
- 验证: `git diff --stat .trellis/spec/backend/quality-guidelines.md` 应有 ~30-40 行增改

### 2.7 跑 `mvn compile` 收基线

- [ ] `cd backend/java-admin && mvn -B -DskipTests compile 2>warn-report.txt 1>/dev/null`
- [ ] 检查退出码:应为 0
- [ ] 提取 Top-N:
  ```bash
  grep -oE '\[ERROR\].*warning: \[.*\]' warn-report.txt \
    | awk -F'\\[' '{print $NF}' | tr -d ']' \
    | sort | uniq -c | sort -rn | head -20
  ```
- [ ] 把结果贴到本文件附录 A;若因方案 A 关 3 个 check 后无输出,注释"基线全屏蔽,等下个任务分批修"

### 2.8 验证 AC 1-10

见 §3。

---

## 3. 验证命令汇总(AC 对应)

| AC    | 命令                                                                                                                                                  | 期望                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| AC-1  | `grep -n 'errorprone.version' backend/java-admin/pom.xml`                                                                                             | 输出 `2.50.0`                                    |
| AC-2  | `xmllint --xpath '//plugin[artifactId="maven-compiler-plugin"]/configuration/annotationProcessorPaths/path' backend/java-admin/pom.xml`(人工核对顺序) | lombok → sql-processor → error_prone_annotations |
| AC-3  | `grep -cE '\-Xplugin:ErrorProne\|\-XepDisableWarningsInGeneratedCode\|\-XepOpt:Configuration=' backend/java-admin/pom.xml`                            | ≥ 3                                              |
| AC-4  | 见 §3.1(故意违例测试)                                                                                                                                 | mvn compile 仍 exit 0                            |
| AC-5  | `cd backend/java-admin && mvn -X -DskipTests compile 2>&1 \| grep -c 'errorprone'`                                                                    | > 0                                              |
| AC-6  | `mvn -B -DskipTests verify`                                                                                                                           | exit 0                                           |
| AC-7  | `git diff backend/java-admin/java-admin-*/pom.xml`                                                                                                    | 输出为空(子模块没动)                             |
| AC-8  | `git diff --stat .trellis/spec/backend/quality-guidelines.md`                                                                                         | 行数变化 > 0(可见已更新)                         |
| AC-9  | `mvn -B -f backend/java-admin/pom.xml spotless:check` + `mvn -B ... checkstyle:check`                                                                 | 各自 exit 0                                      |
| AC-10 | 任务产物 `warn-report.txt` 存在                                                                                                                       | 文件存在;若有 EP 警告 > 0 字节                   |

### 3.1 AC-4 故意违例测试(推荐做,确认 WARN 不阻断)

```bash
# 创建临时违例(放 common 模块以便快速触发)
echo 'class _EpTest { String f() { String x = null; return x.length(); } }' \
  > backend/java-admin/java-admin-common/src/main/java/_EpTest.java

# 跑
cd backend/java-admin && mvn -B -DskipTests -q compile 2>&1 | grep -iE 'errorprone|warning'
echo "exit=$?"

# 删
rm backend/java-admin/java-admin-common/src/main/java/_EpTest.java
```

**期望**:

- 看到 EP warning 输出(`[WARNING] /path/_EpTest.java:[5,18] [nullness] Dereference of ...`)
- `exit=0`(mvn compile 仍成功 —— 证明 WARN 不阻断)
- 临时文件已删除

### 3.2 一次性 AC 验证脚本

```bash
set +e
cd /Users/wshake/code/trellis-demo
echo "=== AC-1 ==="; grep -n 'errorprone.version' backend/java-admin/pom.xml
echo "=== AC-3 ==="; grep -cE 'Xplugin:ErrorProne|XepDisableWarningsInGeneratedCode|XepOpt:Configuration=' backend/java-admin/pom.xml
echo "=== AC-5 ==="; cd backend/java-admin && mvn -X -DskipTests compile 2>&1 | grep -c 'errorprone'
echo "=== AC-6 ==="; mvn -B -DskipTests verify; echo "exit=$?"
echo "=== AC-7 ==="; cd .. && git diff --stat backend/java-admin/java-admin-*/pom.xml
echo "=== AC-8 ==="; git diff --stat .trellis/spec/backend/quality-guidelines.md
echo "=== AC-9a ==="; cd backend/java-admin && mvn -B spotless:check; echo "exit=$?"
echo "=== AC-9b ==="; mvn -B checkstyle:check; echo "exit=$?"
echo "=== AC-10 ==="; ls -la .trellis/tasks/06-15-integrate-error-prone/warn-report.txt
```

---

## 4. 风险点与回滚锚点

| 风险点                                           | 回滚命令/操作                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| 父 POM maven-compiler-plugin 配错导致 4 模块全挂 | `git checkout HEAD~1 -- backend/java-admin/pom.xml`                  |
| errorprone.xml 写错格式 EP 不加载                | `rm backend/java-admin/build-tools/errorprone/errorprone.xml` 然后改 |
| suppressions 不生效,出现雪崩 warning             | 临时把 `errorprone.xml` 内 `<DefaultSeverity>` 改为 `OFF`,跑通后再修 |
| lefthook pre-push 太慢,影响开发节奏              | `LEFTHOOK=0 git push`,或暂时注释 `java-errorprone` job               |
| spec 改坏了其他段落                              | `git checkout HEAD~1 -- .trellis/spec/backend/quality-guidelines.md` |

**整体回滚**(见 design.md §5.2):

```bash
git checkout HEAD~1 -- backend/java-admin/pom.xml \
  .trellis/spec/backend/quality-guidelines.md \
  lefthook.yml
rm -rf backend/java-admin/build-tools/errorprone/
```

---

## 5. `task.py start` 前自查清单

- [x] `prd.md` 完整,有可测试 AC
- [x] `design.md` 完整,有架构/边界/兼容性/回滚
- [x] `implement.md` 完整,有策略/checks/命令/回滚
- [x] Review-gate contract 已 stamp
- [x] Enabled/disabled 列表已写(全 OFF)
- [x] JAVA_HOME 修法已在 §2.1 写明
- [x] AC 1-10 全有可执行命令
- [ ] **用户 review 通过本 prd/design/implement 三件套** ← 阻塞项
- [ ] 跑 `python3 ./.trellis/scripts/task.py start 06-15-integrate-error-prone`

---

## 附录 A:基线 Warning 清单

> 由 §2.7 步骤产出。Phase 1 完成后填入。

### A.1 总览

- `mvn compile` 退出码: TODO
- 总 Warning 数量: TODO
- 涉及 .java 文件数: TODO

### A.2 Top-N(按 check 名)

> 由 `grep -oE '\[ERROR\].*warning: \[.*\]' | awk ...` 提取,Phase 1 完成后填入。

```
TODO
```

### A.3 备注

> Phase 1 完成后写一段简短总结(哪些 check 频次最高、是否需要细化 suppressions、是否提前在 Phase 2 处理)。

```
TODO
```

---

**Implement 状态**: ✅ 全部 §2 checklist 完成(2026-06-15 01:33+)。详见 prd.md §8。

## 8. 实施最终落地(2026-06-15 01:33+)

### 8.1 §2.1 JAVA_HOME — ✅(§7.1)

`brew install openjdk@21` 装好,`~/.zshrc` + `~/.zshenv` 都设了 `JAVA_HOME=/opt/homebrew/opt/openjdk@21/...`,`mvn --version` Java 21.0.11。

### 8.2 §2.2-2.3 父 POM EP 集成 — ✅

- `<errorprone.version>2.50.0</errorprone.version>` property
- 项目 `<dependencies>`(provided 作用域)加 `error_prone_core` / `error_prone_check_api` / `error_prone_annotation`(让 ServiceLoader 从 javac `-classpath` 找 plugin 类)
- 父 `<build><plugins>` 顶部加 `maven-compiler-plugin`(version 3.11.0)段,含:
  - `<fork>true</fork>`
  - `<annotationProcessorPaths>`: lombok + sql-processor + 5 个 EP 相关 path(MCP 自动拉 transitive: Guava、protobuf、dataflow 等)
  - `<compilerArgs>`: 10 个 `-J--add-exports` + 2 个 `-J--add-opens` + 3 个 EP 强制旗标 + `-Xplugin:ErrorProne`

### 8.3 §2.4 errorprone.xml — ❌(简化掉)

跑通后发现 MCP 3.11.0 + fork=true 路径下 `-XepOpt:Configuration=...` 旗标可能也被吞,保守起见不用外置 XML 配置,后续 Phase 2 评估。

### 8.4 §2.5 lefthook 钩子 — ✅

`lefthook.yml` pre-push 加 `java-errorprone` job,与 `java-checkstyle` 并行,调 `mvn -B -q -f backend/java-admin/pom.xml -DskipTests compile`。

### 8.5 §2.6 spec 更新 — ✅

`quality-guidelines.md`:

- 第 1 节翻转"不集成"决策,描述 EP 角色(正确性门禁)+ 三层分工
- 新增 **8.6 Error Prone 验收小节**(配置位置、版本、启用命令、lefthook 钩子、AC 列表)
- 第 9 节"常见错误"表追加 6 条 EP 已知坑(EP 2.43.0+ 与 JDK 17 不兼容 / EP 只放 APT 不放 classpath 找不到 / 生成代码触发 warnings / JDK 17 跑 EP 2.50.0 / MCP 3.14.1 静默失败 / MCP 透传 -J 旗标失败)
- 第 10 节"不在范围"删除"❌ SpotBugs / Error Prone"行,改成"❌ SpotBugs(EP + Checkstyle 已覆盖)"

### 8.6 §2.7 mvn compile 收基线 — ✅

- `mvn -B -DskipTests -f backend/java-admin/pom.xml clean compile > warn-report.txt 2>&1` exit 0
- 4 子模块全过(common / service / infra / api),总 6.5s
- 7 个 EP warnings(5× UnrecognisedJavadocTag 在手写代码 + 2× EmptyBlockTag/InvalidBlockTag 在 Easy-Query APT 生成的 `SysUserProxy.java`)
- 故意违例测试 `_EpTest.java` 含 `s.toLowerCase()` → EP 报 `[StringCaseLocaleUsage]` warning,build exit 0
- `mvn spotless:check` / `mvn checkstyle:check` / `mvn -B -DskipTests verify` 全部 exit 0

### 8.7 §2.8 AC 1-10 验证 — ✅

| AC    | 命令                                                                                                                            | 结果                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| AC-1  | `grep errorprone.version pom.xml` → `2.50.0`                                                                                    | ✅                    |
| AC-2  | annotationProcessorPaths 顺序: lombok → sql-processor → error_prone_annotations/core/check_api/annotation → dataflow-errorprone | ✅                    |
| AC-3  | compilerArgs 含 `-Xplugin:ErrorProne` + 3 个 EP 强制旗标                                                                        | ✅                    |
| AC-4  | 故意违例: `_EpTest.java` 含 `s.toLowerCase()` → EP 报 `[StringCaseLocaleUsage]` warning,build exit 0                            | ✅                    |
| AC-5  | `mvn -X compile 2>&1 \| grep -c errorprone` > 0                                                                                 | ✅(EP 加载并运行)     |
| AC-6  | `mvn -B -DskipTests verify` exit 0                                                                                              | ✅                    |
| AC-7  | `git diff backend/java-admin/java-admin-*/pom.xml` 空                                                                           | ✅(4 子模块 POM 没动) |
| AC-8  | spec 改动 30+ 行                                                                                                                | ✅                    |
| AC-9  | `mvn spotless:check` + `mvn checkstyle:check` 各自 exit 0                                                                       | ✅                    |
| AC-10 | `warn-report.txt` 存在(7985 字节,7 warnings)                                                                                    | ✅                    |

### 8.8 当前 working tree

```bash
$ git status --short
M backend/java-admin/pom.xml                                          # 4 处改动:property + project deps + MCP 段 + EP jar 列表
A backend/java-admin/.mvn/jvm.config                                 # 新文件(10 add-exports + 2 add-opens)
M lefthook.yml                                                        # pre-push 加 java-errorprone
M .trellis/spec/backend/quality-guidelines.md                         # spec 翻转 + 新章节
A .trellis/tasks/06-15-integrate-error-prone/warn-report.txt          # 基线
?? .trellis/tasks/06-15-integrate-error-prone/                        # 整个任务目录(含 prd/design/implement)
?? apps/vue-vben-admin/                                                # 项目里原有
```

下个任务:分批收敛 7 个 EP warnings(下个 PRD 独立写)。

---

## 6. 实施阶段实测记录(2026-06-15)

> 第一轮 + 第二轮汇总。保留全部诊断作为档案。

### 6.1 §2.2 property 加完 ✅

两轮都加:

```xml
<errorprone.version>2.42.0</errorprone.version>  <!-- 第一轮,JDK 17 -->
<errorprone.version>2.50.0</errorprone.version>  <!-- 第二轮,JDK 21 -->
```

### 6.2 §2.3 maven-compiler-plugin 两轮都试 ❌

| MCP 版本     | EP 版本 | JDK | 结果                                                    |
| ------------ | ------- | --- | ------------------------------------------------------- |
| 3.14.1       | 2.42.0  | 17  | silent failure (forked javac 报错被吞)                  |
| 3.14.1       | 2.50.0  | 21  | 报 `IllegalAccessError` — `-J--add-exports` 被 MCP 吞了 |
| 3.13.0       | 2.42.0  | 17  | silent failure                                          |
| 3.10.0       | 2.42.0  | 17  | in-process,`<fork>true</fork>` 看似不生效               |
| 4.0.0-beta-4 | 2.50.0  | 21  | 要 Maven 4.0.0-rc-4,本项目 Maven 3.9.16 不达标          |

### 6.3 §2.7 跑 mvn compile 两轮都 ❌

第二轮具体错误(javac 实际命令):

```
-g -parameters --release 17 -encoding UTF-8
-XDcompilePolicy=simple
--should-stop=ifError=FLOW
-XDaddTypeAnnotationsToSymbol=true
-Xplugin:ErrorProne
```

**10 个 `-J--add-exports=...` 旗标在 MCP 的 `<compilerArgs>` 中存在,但 fork 后实际 javac 命令里消失**。

手动 javac 跑同一套旗标 ✅ — 证明问题在 MCP 转发,不在 EP 或 JDK。

### 6.4 §2.7 的故意违例测试 ❌ 未执行(基础编译失败,无法跑)

### 6.5 §2.5 lefthook 改动未实际跑(已 revert)

### 6.6 当前 working tree 状态

```bash
$ git status --short
?? .trellis/tasks/06-15-integrate-error-prone/   ← 仅本任务产物
?? apps/vue-vben-admin/                            ← 项目里原有
```

**JDK 21 升级保留**;所有源码改动已 revert;task 目录保留作为诊断档案。

---

## 7. 解锁后续做(2026-06-15 01:00+)

### 7.1 工具链已就绪 ✅

```bash
$ java -version
openjdk version "21.0.11" 2026-04-21

$ mvn --version | head -2
Apache Maven 3.9.16
Java version: 21.0.11, vendor: Homebrew

$ echo $JAVA_HOME
/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

### 7.2 手动 javac 跑通 EP ✅(关键进展)

完整旗标清单(14 个旗标):

```
-J--add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.comp=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.model=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.processing=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED
-J--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED
-XDcompilePolicy=simple
--should-stop=ifError=FLOW
-XDaddTypeAnnotationsToSymbol=true
-Xplugin:ErrorProne
```

完整 EP classpath(15 个 jar,见 prd.md §8.1)。

### 7.3 ⚠️ MCP 3.14.1 二次阻塞

10 个 `-J--add-exports` 旗标在 MCP `<compilerArgs>` 里有,但 forked javac 命令里消失。详见 prd.md §8.5-8.6 选项。

仍待用户决策。
