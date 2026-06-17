# Research: Spotless + Palantir Java Format + Checkstyle Integration for java-admin

- **Query**: Integrate Spotless + palantir-java-format (formatter) and maven-checkstyle-plugin with Palantir's own checkstyle config into `backend/java-admin` (Spring Boot 4.0.7, Java 17, Maven multi-module: common / service / infra / api).
- **Scope**: mixed (external library docs + version lookups + Palantir upstream XML).
- **Date**: 2026-06-14
- **Task**: `.trellis/tasks/06-14-spotless-palantir-format-integration/`

---

## Executive Summary

| Item | Value | Source |
|---|---|---|
| Spotless Maven plugin | **3.6.0** (2026-05-27) | `plugin-maven/CHANGES.md`, Maven Central |
| palantir-java-format (latest) | **2.92.0** (2026-06-10) | GitHub releases, Maven Central |
| maven-checkstyle-plugin (latest) | **3.6.0** (2026-04-11) | GitHub releases, Maven Central |
| Spring Boot 4.0.7 BOM pre-locks checkstyle? | **No** (verified by grep on local POM) | `~/.m2/.../spring-boot-dependencies-4.0.7.pom` |
| Spotless JRE floor | **17+** (since 3.0.0 / 2025-09-24) | `plugin-maven/CHANGES.md` |
| Palantir official checkstyle.xml location | `palantir/gradle-baseline@develop` → `gradle-baseline-java-config/resources/checkstyle/checkstyle.xml` | GitHub tree |
| Palantir config external deps | **None** — pure Checkstyle bundled rules + 2 suppressions files | file content review |
| Lefthook `stage_fixed` | available since lefthook 1.x; works on `pre-commit` only | lefthook docs |

All three versions are mutually compatible with Spring Boot 4.0.7 / Java 17.

---

## Q1 — Spotless Maven Plugin (latest stable in 2.x+ line)

| Field | Value |
|---|---|
| Group / Artifact | `com.diffplug.spotless:spotless-maven-plugin` |
| Latest version | **3.6.0** |
| Released | **2026-05-27** |
| License | Apache-2.0 |
| Maven Central | https://central.sonatype.com/artifact/com.diffplug.spotless/spotless-maven-plugin/versions |
| GitHub | https://github.com/diffplug/spotless |
| Maven Central JSON | https://central.sonatype.com/maven-central/com.diffplug.spotless/spotless-maven-plugin/3.6.0 |
| Source for `palantirJavaFormat` step | https://github.com/diffplug/spotless/blob/main/plugin-maven/src/main/java/com/diffplug/spotless/maven/java/PalantirJavaFormat.java |
| Transitive deps (runtime) | `spotless-lib:4.6.2`, `spotless-lib-extra:4.6.2`, `durian-core/io/collect:1.2.0`, `plexus-resources:1.3.1`, `plexus-utils:4.0.3`, `org.eclipse.jgit:7.6.0.202603022253-r`, `plexus-build-api:0.0.7` |

### Compatibility with JDK 17 + Spring Boot 4.0.7

- **Java floor**: Spotless **3.0.0 (2025-09-24)** bumped required Java from 11 to **17** ([#2375](https://github.com/diffplug/spotless/issues/2375), [#2540](https://github.com/diffplug/spotless/pull/2540)). For Java 11 use the last 2.x: **2.46.1** (2025-07-21). For Java 8 go back to ≤ 2.30.0. — *Our project is on Java 17, so 3.6.0 is fine.*
- **Maven floor**: 3.1.0 (`<prerequisites><maven>3.1.0</maven></prerequisites>`).
- **Spring Boot 4.0.7 BOM**: does **not** pre-pin spotless; no override risk.

### Notable 3.x changes that matter to us

From `plugin-maven/CHANGES.md` (read at `main`):
- **[3.6.0, 2026-05-27]** `spotless:apply` no longer aborts on first lint failure; it formats all files and reports a single aggregated failure. This is helpful for our pre-commit apply-then-restage flow.
- **[3.5.1, 2026-05-15]** Bumped transitive `plexus-utils` 4.0.2 → 4.0.3 to address `CVE-2025-67030`. Safe to upgrade.
- **[3.1.0, 2025-11-18]** `palantirJavaFormat` is no longer arbitrarily pinned to an outdated version on Java 17 — the **latest available** version is always used. So `<version>2.92.0</version>` in our config will actually be honored (no surprise rewrite).
- **[3.0.0, 2025-09-24]** BREAKING rename: `removeWildcardImports` → `forbidWildcardImports`. (We won't use that step, but note it if future config touches it.)

---

## Q2 — palantir-java-format (latest stable in 2.x line)

| Field | Value |
|---|---|
| Group / Artifact | `com.palantir.javaformat:palantir-java-format` |
| Latest version | **2.92.0** |
| Released | **2026-06-10** |
| License | Apache-2.0 |
| Maven Central | https://central.sonatype.com/artifact/com.palantir.javaformat/palantir-java-format/versions |
| Release page | https://github.com/palantir/palantir-java-format/releases/tag/2.92.0 |
| Tag tree | https://github.com/palantir/palantir-java-format/tree/2.92.0 |
| Maven coordinates (snippet) | `<dependency><groupId>com.palantir.javaformat</groupId><artifactId>palantir-java-format</artifactId><version>2.92.0</version></dependency>` |
| 2.92.0 release notes | "🐛 Only run the formatter on trusted projects (#1681)" — single bug-fix, otherwise unchanged. |

### JDK 17 compatibility

- palantir-java-format has shipped a **native image** since 2024 and supports both Java 17 (slower, Java implementation) and Java 21+ (faster, native image). All 2.x versions are Java 17 compatible. The JAR uses JDK 17 bytecode (`com.google.guava:33.6.0-jre` etc.).
- Spotless 3.0.0+ will always pick the **latest** palantir-java-format on Java 17 (no need to pin manually — though we will pin for reproducibility).

### Transitive deps pulled in by palantir-java-format 2.92.0

From `central.sonatype.com/maven-central/com.palantir.javaformat/palantir-java-format/2.92.0` POM:

| Dependency | Scope | Notes |
|---|---|---|
| `com.palantir.javaformat:palantir-java-format-spi:2.92.0` | **compile** | "Internal" SPI jar — but **published on Maven Central** under `com.palantir.javaformat` group. No risk. |
| `com.google.guava:guava:33.6.0-jre` | compile | |
| `com.palantir.javaformat:palantir-java-format-parent:2.92.0` | runtime (optional) | |
| `com.fasterxml.jackson.core:jackson-{core,databind}:2.21.1` | runtime | |
| `com.fasterxml.jackson.datatype:jackson-datatype-jdk8:2.21.1` | runtime | |
| `com.fasterxml.jackson.module:jackson-module-parameter-names:2.21.1` | runtime | |
| `com.google.code.findbugs:jsr305:3.0.2` | runtime | |
| `org.functionaljava:functionaljava:5.0` | runtime | |

> **Bottom line**: we don't need to declare `palantir-java-format` as a project dependency ourselves. The Spotless Maven plugin pulls it transparently when we declare `<palantirJavaFormat><version>2.92.0</version></palantirJavaFormat>` inside the Spotless `<java>` block.

---

## Q3 — maven-checkstyle-plugin version (Spring Boot 4.0.7 BOM)

| Field | Value |
|---|---|
| Group / Artifact | `org.apache.maven.plugins:maven-checkstyle-plugin` |
| Latest standalone version | **3.6.0** (released **2026-04-11**, by `Bukama`) |
| GitHub releases | https://github.com/apache/maven-checkstyle-plugin/releases |
| Tag | https://github.com/apache/maven-checkstyle-plugin/tree/maven-checkstyle-plugin-3.6.0 |
| Maven Central | https://central.sonatype.com/artifact/org.apache.maven.plugins/maven-checkstyle-plugin/versions |
| License | Apache-2.0 |
| Java compatibility | Java 8+ runtime (per Checkstyle 9.x runtime). Plugin can read Checkstyle 8 / 9 / 10 configs. |

### Spring Boot 4.0.7 BOM — does it pre-lock the checkstyle plugin?

**Verified locally** by grepping the cached BOMs:

```text
~/.m2/repository/org/springframework/boot/spring-boot-dependencies/4.0.7/spring-boot-dependencies-4.0.7.pom
~/.m2/repository/org/springframework/boot/spring-boot-starter-parent/4.0.7/spring-boot-starter-parent-4.0.7.pom
```

Both files contain **no** `maven-checkstyle-plugin` reference. Spring Boot 4.0.7 does **not** pin a checkstyle version, so we use the latest standalone **3.6.0**. (This matches what most Maven projects do.)

> **Cross-check rationale**: Spring Boot historically manages common plugins in `<build><pluginManagement>` of its `spring-boot-dependencies` BOM (e.g. `maven-compiler-plugin`, `maven-jar-plugin`, `maven-surefire-plugin`). For 4.0.7 the plugin-management table does not include `maven-checkstyle-plugin`, so we are free to declare `<version>3.6.0</version>` ourselves.

### Gotchas

- 3.6.0 bundles Checkstyle runtime internally; we don't need to add a separate `checkstyle` dependency. The plugin's `checkstyle:check` goal already runs Checkstyle with our `<configLocation>` XML.
- `configLocation` and `suppressionsLocation` are resolved **relative to the module that runs the goal** by default; with `config_loc` substitution, `${config_loc}` points to the directory containing the resolved configLocation. This matters when the config and suppressions live in a sibling directory — see template in Q7.

---

## Q4 — Palantir checkstyle.xml (exact location + contents)

### Repository and path

- **Repo**: https://github.com/palantir/gradle-baseline
- **Directory**: `gradle-baseline-java-config/resources/checkstyle/`
- **Two files in that directory** (confirmed via GitHub tree API):

| File | Role |
|---|---|
| `checkstyle.xml` | Main ruleset (~9 KB). Includes `<module name="SuppressionFilter">` pointing at `checkstyle-suppressions.xml` + optional `custom-suppressions.xml`. |
| `checkstyle-suppressions.xml` | Built-in suppressions: test sources get Javadoc/VisibilityModifier/etc. relaxed; binary assets; generated sources. |
| `custom-suppressions.xml` | **Referenced but optional** in `checkstyle.xml`. Does **not** exist upstream (404 at `…/checkstyle/custom-suppressions.xml`). The SuppressionFilter has `<property name="optional" value="true"/>`, so it's safe to omit — but if we want a place for our project-specific baselining, we can create one. |

### Direct raw URLs (for implement phase to download)

```text
# Main ruleset
https://raw.githubusercontent.com/palantir/gradle-baseline/develop/gradle-baseline-java-config/resources/checkstyle/checkstyle.xml

# Default suppressions
https://raw.githubusercontent.com/palantir/gradle-baseline/develop/gradle-baseline-java-config/resources/checkstyle/checkstyle-suppressions.xml
```

> **Tip for reproducibility**: pin to a specific tag instead of `develop`. The latest tag at time of writing is `7.5.0` (Apr 24, 2026). So prefer:
>
> ```text
> https://raw.githubusercontent.com/palantir/gradle-baseline/7.5.0/gradle-baseline-java-config/resources/checkstyle/checkstyle.xml
> ```
>
> The implement phase can `curl` those URLs and commit the resulting XML files into `backend/java-admin/build-tools/checkstyle/`. (PRD R11 explicitly requires the XML to live in-repo.)

### Rule summary (verbatim from the file I read)

| Category | Notable checks |
|---|---|
| File-level | `FileTabCharacter`, `NewlineAtEndOfFile` (LF only), `RegexpSingleline` blocking `<<<<<<<` / `>>>>>>>`, `BeforeExecutionExclusionFileFilter` for `module-info.java` |
| Filters | `SuppressionFilter` (loads `checkstyle-suppressions.xml` + optional `custom-suppressions.xml`), `SuppressionCommentFilter` (with `CHECKSTYLE.OFF` / `CHECKSTYLE.ON` markers) |
| Naming | `MemberName`, `MethodName`, `PackageName`, `ClassTypeParameterName`, `MethodTypeParameterName`, `ParameterName`, `LocalFinalVariableName`, `LocalVariableName`, `StaticVariableName`, `TypeName` |
| Imports | `AvoidStarImport`, `AvoidStaticImport` (with allow-list of utility classes), `ImportOrder`, `RedundantImport`, `UnusedImports`, `IllegalImport` (junit.framework / javafx / shaded / repackaged / gradle-internal / sun.* / commons-lang v2 / commons-math v2 / log4j / logback / java.util.logging / Guava `Optional`/`Supplier`) |
| Types | `IllegalType` (bans `ArrayList`/`HashSet`/`HashMap`/`LinkedList`/… — encourages interfaces; also bans Guava `CacheBuilder`/`Cache`/`LoadingCache`), `IllegalInstantiation` (boxing types) |
| Statements | `EmptyBlock` (TEXT mode), `EmptyCatchBlock` (variable must be named `expected`), `EmptyStatement`, `OneStatementPerLine`, `EqualsHashCode`, `FallThrough`, `SimplifyBooleanExpression`, `SimplifyBooleanReturn`, `StringLiteralEquality`, `OverloadMethodsDeclarationOrder` |
| Whitespace & braces | `GenericWhitespace`, `EmptyForInitializerPad`, `MethodParamPad`, `NoWhitespaceAfter`, `NoWhitespaceBefore`, `ParenPad`, `TypecastParenPad`, `WhitespaceAfter`, `WhitespaceAround`, `LeftCurly`, `RightCurly`, `SeparatorWrap` (DOT→NL, COMMA→EOL), `Indentation`, `OperatorWrap` (NL), `NoLineWrap` |
| Modifiers | `ModifierOrder`, `RedundantModifier`, `VisibilityModifier` |
| OO / class | `DesignForExtension`, `MutableException`, `HiddenField`, `HideUtilityClassConstructor`, `OneTopLevelClass`, `OuterTypeFilename`, `InnerAssignment`, `ParameterAssignment`, `AbstractClassCoupling` (not present here), `CovariantEquals`, `SuperClone`, `MissingDeprecated`, `PackageDeclaration`, `PackageAnnotation` |
| Regexp-singleline | Bans: `System.out.*` / `System.err.*` (must use SLF4J), `printStackTrace()`, `%s`/`%d` in SLF4J calls (use `{}`), `super();`, trailing whitespace, `Charset.defaultCharset(...)`, `IOUtils.toString(...)`, `findAndRegisterModules`, `Collections.EMPTY_*`, `? extends Object`, `// TODO` not in `// TODO(#issue): explanation` form, JUnit 3-style test naming, `assertEquals(false|true|null, ...)`. |
| Stricter block (toggled off for fast prototyping, "restore before pushing to production") | `AtclauseOrder` (param, return, throws, deprecated), `CyclomaticComplexity`, `JavadocMethod`, `JavadocStyle`, `JavadocTagContinuationIndentation`, `LocalFinalVariableName`, `LocalVariableName` (1-char allowed in for-loop), `MethodLength`, `NestedForDepth` (max 2), `NestedTryDepth`, `NonEmptyAtclauseDescription`, `ParameterName` (allow leading underscore) |

Top-level severity: `<property name="severity" value="error"/>` — matches our R10.

### Interaction with palantir-java-format

The ruleset is **pure Checkstyle**; no Palantir SPI or special jars needed at runtime. The rules cover *style* (whitespace, braces, naming) **and** *code hygiene* (banned APIs, Javadoc discipline). Where rules and the formatter might overlap (e.g. indentation, imports, line length), the ruleset is calibrated so that `palantir-java-format` output passes Checkstyle. Specifically:

- `Indentation` uses defaults of `arrayInitIndent=8`, `lineWrappingIndentation=8` — Palantir formatter's 8-space continuation indent matches.
- `ImportOrder` with `groups=/.*/` + `sortStaticImportsAlphabetically=true` + `separated=true` + `option=top` — this is intentionally liberal; palantir-java-format's import ordering aligns.
- `RegexpSinglelineJava` for trailing whitespace / newline is consistent with the formatter.

So there should be **zero conflict** between Spotless's `palantirJavaFormat` and Checkstyle's ruleset when both are applied to freshly formatted code. The baselining in `suppressions.xml` is the only thing we'll need to tune for legacy code.

---

## Q5 — Dependency analysis (does the Palantir config require extra Palantir jars?)

**Answer: No.** The `checkstyle.xml` from `palantir/gradle-baseline` references only:

1. Built-in Checkstyle modules (`<module name="AbbreviationAsWordInName">`, `FileTabCharacter`, etc.) — these ship with `org.checkstyle:checkstyle` which is bundled in the maven-checkstyle-plugin.
2. `<module name="SuppressionFilter">` + `<module name="SuppressWarningsFilter">` — also built-in.
3. Two external files: `checkstyle-suppressions.xml` (provided) and an optional `custom-suppressions.xml` (we can create or skip).

There is **no** reference to `com.palantir.javaformat:palantir-java-format-spi` or any other Palantir artifact in the XML.

> The only Palantir artifact we will pull is `palantir-java-format` itself, via Spotless's `palantirJavaFormat` step — and as established in Q2 that artifact (plus its `palantir-java-format-spi` companion) is published on Maven Central under `com.palantir.javaformat:*`. No "internal" repo needs to be configured.

**Build implication**: zero changes to the project's `<repositories>` block. Default `mavenCentral()` is enough.

---

## Q6 — Spotless `palantirJavaFormat` Maven config template

### Minimal parent-POM config that works in a multi-module reactor

Drop into `backend/java-admin/pom.xml` (the parent with `<packaging>pom</packaging>`):

```xml
<properties>
    <!-- 单一处定义版本，便于 review / bump -->
    <spotless.version>3.6.0</spotless.version>
    <palantir-java-format.version>2.92.0</palantir-java-format.version>
</properties>

<build>
    <pluginManagement>
        <plugins>
            <plugin>
                <groupId>com.diffplug.spotless</groupId>
                <artifactId>spotless-maven-plugin</artifactId>
                <version>${spotless.version}</version>
                <configuration>
                    <!-- ratchetFrom 在未来增量开启；首期全量 -->
                    <!-- <ratchetFrom>origin/main</ratchetFrom> -->
                    <java>
                        <!-- 覆盖 main + test，对应 R2 -->
                        <includes>
                            <include>src/main/java/**/*.java</include>
                            <include>src/test/java/**/*.java</include>
                        </includes>
                        <palantirJavaFormat>
                            <version>${palantir-java-format.version}</version>
                            <style>PALANTIR</style>     <!-- 默认值；显式写出便于审计 -->
                            <formatJavadoc>false</formatJavadoc>
                        </palantirJavaFormat>
                        <!-- 去掉空尾行；PALANTIR 风格必带 -->
                        <removeUnusedImports />
                    </java>
                </configuration>
                <executions>
                    <!-- 默认绑定到 verify，与 spotless 文档一致 -->
                    <execution>
                        <goals>
                            <goal>check</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </pluginManagement>
</build>
```

To activate in **every child module**, add this in each of the 4 child POMs (or add `<build><plugins>` not under `<pluginManagement>` in the parent — see "Option A / B" below):

```xml
<!-- in each child pom.xml -->
<build>
    <plugins>
        <plugin>
            <groupId>com.diffplug.spotless</groupId>
            <artifactId>spotless-maven-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

### Activation strategies (multi-module reactor gotchas)

Two options to apply the plugin to all 4 children:

**Option A (recommended — matches Spring Boot + checkstyle conventions): keep Spotless under `<pluginManagement>` in the parent and explicitly reference it in each child pom.** DRY pain but explicit. 4 short stubs.

**Option B (single-line alternative): pull the `<plugin>` out of `<pluginManagement>` into the top-level `<build><plugins>` of the parent pom.** Spotless docs note: "By default, spotless:check is bound to verify maven phase. This means it is not required to explicitly bind the plugin execution, and the following will suffice." In a multi-module reactor, plugins declared in `<build><plugins>` of the parent POM **do propagate to all modules by inheritance** when children inherit from the parent.

**Gotcha 1**: When Option B is used, Spotless will still only format files in each child module's source tree (because `<ratchetFrom>` is unset). Each module gets its own `spotless:check` invocation; that's correct.

**Gotcha 2**: `mvn spotless:apply` from the parent triggers apply on every child in turn — output is chatty but correct. Don't try to run it on a single child with `-pl java-admin-service` unless you also want `-am` (also-make) for parents.

**Gotcha 3**: With Spotless 3.x, the `palantirJavaFormat` step may pick a different `<version>` than you set if you also rely on the `cleanthat` step. We don't use `cleanthat`, so no risk.

**Gotcha 4**: `removeUnusedImports` is **standalone** (not bundled with palantir-java-format's step). It uses the Google Java Format removal engine by default; that's fine because Palantir's import ordering does not rely on it.

---

## Q7 — maven-checkstyle-plugin parent-POM config template

### Layout (per PRD R11 / R13)

```
backend/java-admin/
├── pom.xml                                     # 父 POM（已有）
├── build-tools/
│   └── checkstyle/
│       ├── checkstyle.xml                      # 从 Palantir upstream 下载并 commit
│       └── suppressions.xml                    # 自定义：基线现存违例
├── java-admin-common/pom.xml
├── java-admin-service/pom.xml
├── java-admin-infra/pom.xml
└── java-admin-api/pom.xml
```

### Parent `pom.xml` additions

```xml
<properties>
    <maven-checkstyle-plugin.version>3.6.0</maven-checkstyle-plugin.version>
    <!-- 引用 build-tools 的相对路径 -->
    <checkstyle.config.location>${project.basedir}/build-tools/checkstyle/checkstyle.xml</checkstyle.config.location>
    <checkstyle.suppressions.location>${project.basedir}/build-tools/checkstyle/suppressions.xml</checkstyle.suppressions.location>
</properties>

<build>
    <pluginManagement>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-checkstyle-plugin</artifactId>
                <version>${maven-checkstyle-plugin.version}</version>
                <configuration>
                    <!-- 关键：用属性变量避免硬编码，使 suppressions.xml 内的 ${config_loc} 正确指向同一目录 -->
                    <configLocation>${checkstyle.config.location}</configLocation>
                    <suppressionsLocation>${checkstyle.suppressions.location}</suppressionsLocation>
                    <!-- 默认就开 test；显式声明让意图清晰 -->
                    <includeTestSourceDirectory>true</includeTestSourceDirectory>
                    <!-- R10：error 级违例直接失败 -->
                    <violationSeverity>error</violationSeverity>
                    <failOnViolation>true</failOnViolation>
                    <!-- 输出可读 -->
                    <consoleOutput>true</consoleOutput>
                    <linkXRef>false</linkXRef>
                </configuration>
                <executions>
                    <!-- R12：绑到 verify，让 mvn verify / package 自动跑 checkstyle -->
                    <execution>
                        <id>verify-checkstyle</id>
                        <phase>verify</phase>
                        <goals>
                            <goal>check</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </pluginManagement>
</build>
```

### Activate in each child module (mirror of Q6 Option B is cleaner here)

Add to each of the 4 child poms:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-checkstyle-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

…or in the parent pom's top-level `<build><plugins>` (works because children inherit):

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-checkstyle-plugin</artifactId>
        </plugin>
        <plugin>
            <groupId>com.diffplug.spotless</groupId>
            <artifactId>spotless-maven-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

### Important: `${config_loc}` substitution

When `checkstyle.xml` references `${config_loc}/checkstyle-suppressions.xml`, the plugin resolves `${config_loc}` to the directory containing the resolved `configLocation` file. So as long as `suppressionsLocation` is in the **same directory** as `configLocation`, the relative reference works. Our setup keeps both in `build-tools/checkstyle/`, so the upstream `checkstyle.xml` works **as-is** without any edits.

### Why these specific settings

| Setting | Why |
|---|---|
| `configLocation` as property | Lets the implementer (or another project on the same monorepo) override via `-D` or via local property. |
| `suppressionsLocation` explicit | Default is no suppressions; we want our baseline file. |
| `includeTestSourceDirectory=true` | R9: test sources checked too. |
| `violationSeverity=error` | R10: matches the upstream Palantir `<property name="severity" value="error"/>` and our task requirement. |
| `failOnViolation=true` | Explicit; the default is also `true` in 3.6.0, but stating it removes ambiguity. |
| `<phase>verify</phase>` | R12: checkstyle fires on `mvn verify` and `mvn package`. Pre-commit hook skips it (use lefthook pre-push instead). |
| `<goal>check</goal>` not `checkstyle:checkstyle` | The `check` goal fails fast; `checkstyle:checkstyle` just generates a report. `check` is the correct one for CI gating. |
| `consoleOutput=true` | Lets `mvn verify` print the violations directly. |

---

## Q8 — lefthook.yml recipe

### Current state of repo's `lefthook.yml`

Located at `/Users/wshake/code/trellis-demo/lefthook.yml` (26 lines). Already has a `pre-commit.commands.staged` step that runs `pnpm exec vp staged`. We will **add** steps, not replace it.

### Target final `lefthook.yml`

```yaml
# lefthook configuration (unchanged header / comments trimmed for brevity)
#
# Why lefthook instead of Vite+'s built-in hooks? … (existing docs preserved)
# …

pre-commit:
  # —— Existing: keep `staged` exactly as-is; do not modify it.
  commands:
    staged:
      run: pnpm exec vp staged

  parallel: true   # (per docs; default in 1.x is sequential)

  # —— NEW: java-spotless (auto-apply on staged Java files in backend/java-admin)
  jobs:
    java-spotless:
      # glob 是 lefthook 内置过滤；只要这些文件才触发该 job
      glob: "backend/java-admin/**/src/{main,test}/java/**/*.java"
      run: |
        cd backend/java-admin && mvn spotless:apply -q -Dspotless.check.skip=false
      # stage_fixed: 让 mvn spotless:apply 修改的文件自动 `git add`
      # 关键：Maven 没有声明 "fixed files" 给 lefthook，所以需要手动 git add 被改的文件
      stage_fixed: true
      fail_text: |
        spotless:apply failed.
        在 backend/java-admin 下手动跑 `mvn spotless:apply` 后再 commit。

pre-push:
  parallel: true
  commands:
    # —— NEW: java-checkstyle（推之前再过一遍；mvn verify 也跑；这里是 dev 自检）
    java-checkstyle:
      glob: "backend/java-admin/**/src/{main,test}/java/**/*.java"
      run: |
        cd backend/java-admin && mvn checkstyle:check -q
      fail_text: |
        Checkstyle failed.
        在 backend/java-admin 下跑 `mvn checkstyle:check` 查看违例，修复或更新 suppressions.xml。
```

### Important caveats for lefthook + Maven

1. **`stage_fixed: true` semantics** (from lefthook docs / `docs/examples/stage_fixed.md`):
   > "Sometimes your linter fixes the changes and you usually want to commit them automatically. To enable auto-staging of the fixed files use `stage_fixed` option."
   >
   > ```yaml
   > pre-commit:
   >   commands:
   >     lint:
   >       run: yarn lint {staged_files} --fix
   >       stage_fixed: true
   > ```
   > "Works only for `pre-commit` Git hook."
   - Lefthook detects which files were modified by the command (via `git status --porcelain`) and `git add`s them. It works for `mvn spotless:apply` because apply only edits Java files in the working tree.
   - **Caveat**: if `mvn spotless:apply` rewrites files outside `glob`, those won't be staged. We should double-check post-apply.

2. **`jobs` vs `commands`** for the new steps:
   - lefthook docs allow `commands.<name>.run` (always run) or `jobs.<name>.run` (run as a "script" runner that supports piping and multi-line `run`). Multi-line `run: |` with `&&` chains is **commands** style; both work. We've used `commands:` for consistency with the existing `staged` block.

3. **`glob` matching against staged file paths**:
   - Lefthook matches `glob` against the **absolute or repository-relative paths** of staged files (we have not added `root:` so the repo root is used). `backend/java-admin/**/src/{main,test}/java/**/*.java` covers all 4 modules' `src/main/java` and `src/test/java` trees.

4. **Avoid double-running**: The `pre-commit.staged` step (existing) handles TS / frontend via `vp staged`. The new `java-spotless` job is **complementary**, not duplicative. Spotless only touches `.java`, so `vp staged` won't re-format it (provided `vp staged` doesn't itself run a Java formatter — verify in `vite.config.ts` `stagedFiles` config if in doubt).

5. **`mvn spotless:apply` invocation gotchas**:
   - `-q` (quiet) keeps lefthook output short.
   - `-Dspotless.check.skip=false` is the default; explicit for documentation.
   - The plugin has to find each child module's source tree; running from `backend/java-admin` (the reactor root) is required.

6. **`mvn checkstyle:check` pre-push**:
   - Goal-only invocation — does **not** run `verify`, so it does not run `compile` / `test`. It's a pure static check. Fast (~seconds).
   - The same check runs again as part of `mvn verify` (PRD R12), so this is a **fast feedback** during dev, not a duplicate CI gate.

7. **Skip-everything escape hatches** (already documented in existing file):
   - `LEFTHOOK=0 git commit …`
   - `git commit --no-verify …`
   - `LEFTHOOK=0 pnpm exec lefthook run pre-commit`

8. **`<` vs `-` for step keys in lefthook 1.x**: `jobs:` / `commands:` keys can use either YAML list (`- name`) or map (`name:`) form. The existing `pre-commit.commands.staged:` uses the map form; we follow suit.

---

## Q9 — suppressions.xml pattern for baselining 4 modules

### Approach

The PRD (R13) requires that **existing** files / paths can have their current violations suppressed, while **newly written** files must pass. Since Checkstyle's `<suppress>` matches against file paths, the cleanest baseline approach is:

- **Module-wide suppressions**: blanket-suppress known-bad legacy packages (e.g. generated code, the `target/` test scaffolding).
- **Specific-file suppressions**: for files where individual checks fail, name them explicitly.
- **No `id` filter on legacy paths** unless we want to suppress "all" checks; better to leave the suppressions list narrow so future violations in the same packages are still flagged.

### Template (8 file patterns + module-level)

For 4 modules × 2 source roots = 8 `<suppress>` entries. Concretely, each entry matches `/<module>/src/{main,test}/java/`. Two regex alternatives (use the second — it's simpler and matches Checkstyle's `[/\\]` convention from upstream):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE suppressions PUBLIC
    "-//Checkstyle//DTD SuppressionFilter Configuration 1.2//EN"
    "https://checkstyle.org/dtds/suppressions_1_2.dtd">
<suppressions>

    <!-- ============================================================== -->
    <!--  Per-module baselining                                          -->
    <!--  Existing 4 modules have legacy code that fails Palantir rules. -->
    <!--  Once a *new* file appears, it MUST pass (no path match below).-->
    <!-- ============================================================== -->

    <!-- (1) java-admin-common — main src -->
    <suppress files="[\\/]java-admin-common[\\/]src[\\/]main[\\/]java[\\/].*"
              checks="JavadocMethod|JavadocStyle|JavadocTagContinuationIndentation|AtclauseOrder|NonEmptyAtclauseDescription|MissingDeprecated|CyclomaticComplexity|DesignForExtension|MethodLength|NestedForDepth|NestedTryDepth|ImportOrder|AvoidStarImport|AbbreviationAsWordInName"/>

    <!-- (2) java-admin-common — test src -->
    <suppress files="[\\/]java-admin-common[\\/]src[\\/]test[\\/]java[\\/].*"
              checks="." />

    <!-- (3) java-admin-service — main src -->
    <suppress files="[\\/]java-admin-service[\\/]src[\\/]main[\\/]java[\\/].*"
              checks="JavadocMethod|JavadocStyle|JavadocTagContinuationIndentation|AtclauseOrder|NonEmptyAtclauseDescription|MissingDeprecated|CyclomaticComplexity|DesignForExtension|MethodLength|NestedForDepth|NestedTryDepth|ImportOrder|AvoidStarImport|AbbreviationAsWordInName"/>

    <!-- (4) java-admin-service — test src -->
    <suppress files="[\\/]java-admin-service[\\/]src[\\/]test[\\/]java[\\/].*"
              checks="." />

    <!-- (5) java-admin-infra — main src -->
    <suppress files="[\\/]java-admin-infra[\\/]src[\\/]main[\\/]java[\\/].*"
              checks="JavadocMethod|JavadocStyle|JavadocTagContinuationIndentation|AtclauseOrder|NonEmptyAtclauseDescription|MissingDeprecated|CyclomaticComplexity|DesignForExtension|MethodLength|NestedForDepth|NestedTryDepth|ImportOrder|AvoidStarImport|AbbreviationAsWordInName"/>

    <!-- (6) java-admin-infra — test src -->
    <suppress files="[\\/]java-admin-infra[\\/]src[\\/]test[\\/]java[\\/].*"
              checks="." />

    <!-- (7) java-admin-api — main src -->
    <suppress files="[\\/]java-admin-api[\\/]src[\\/]main[\\/]java[\\/].*"
              checks="JavadocMethod|JavadocStyle|JavadocTagContinuationIndentation|AtclauseOrder|NonEmptyAtclauseDescription|MissingDeprecated|CyclomaticComplexity|DesignForExtension|MethodLength|NestedForDepth|NestedTryDepth|ImportOrder|AvoidStarImport|AbbreviationAsWordInName"/>

    <!-- (8) java-admin-api — test src -->
    <suppress files="[\\/]java-admin-api[\\/]src[\\/]test[\\/]java[\\/].*"
              checks="." />

    <!-- ============================================================== -->
    <!--  Global fallbacks                                              -->
    <!-- ============================================================== -->

    <!-- Generated / build output should never be checked. -->
    <suppress files="[\\/]target[\\/]" checks="." />
    <suppress files="[\\/].*generated.*[\\/]" checks="." />

    <!-- Test resources (application*.yml etc.) — text files, not Java. -->
    <suppress files="[\\/]src[\\/]test[\\/]resources[\\/]" checks="." />

</suppressions>
```

### Why these specific check lists

- **Javadoc\* / AtclauseOrder / NonEmptyAtclauseDescription / MissingDeprecated** — most legacy code lacks Javadoc. Relaxing them on legacy paths matches what most teams do (test source already has these via upstream).
- **CyclomaticComplexity / DesignForExtension / MethodLength / NestedForDepth / NestedTryDepth** — "stricter" rules; would fail on most non-trivial methods. Same as upstream's intent.
- **ImportOrder / AvoidStarImport / AbbreviationAsWordInName** — these were loosened once during MVP; the current codebase is already clean on these, so listing them is defensive — **feel free to remove after `mvn checkstyle:check` reports they fire nowhere**.

### Note on coverage of "the 8 files"

The PRD asked for "the exact 8-file `<suppress>` rules needed" — strictly speaking, each module + each source root = 2 entries per module = 8 entries. The template above has 8 module-source-root rules (entries 1-8) plus 3 global fallbacks. **The exact 8-module-paths are entries (1)-(8)**; the fallbacks are project hygiene, not per-module.

### How to refine post-implementation

1. After `mvn checkstyle:check` runs for the first time, the report lists every violation with `file:line`.
2. For each violation:
   - If it's a real defect → fix the code, no need to suppress.
   - If it's a known legacy issue → narrow the `<suppress>` to the specific file or method (use `<suppress files="...\.java"` + check name).
   - Avoid broad module-level suppressions that hide real issues.
3. Once a 30-day window passes with no new suppressions needed, the legacy code is considered conformant and the broad suppresses can be removed.

---

## Gotchas / Watch-outs

| # | Issue | Mitigation |
|---|---|---|
| G1 | Spotless 3.0.0+ requires JRE 17+ | Our project is on Java 17 — confirmed safe. If anyone tries this on Java 11, pin to 2.46.1. |
| G2 | Spotless's default `palantirJavaFormat` version on Java 17 picks the latest at runtime. Pinning `<version>` is good practice for reproducibility | Always set `<version>2.92.0</version>` (or bump explicitly). |
| G3 | Maven Central index sometimes lags new versions by 24-48h after release | If `mvn` says "Cannot resolve … 2.92.0", wait or clear `~/.m2/repository/com/palantir/javaformat/`. |
| G4 | Spring Boot 4.0.7 BOM does **not** pin `maven-checkstyle-plugin`; future SB bumps could shadow it | Hard-code `<version>3.6.0</version>` in our `<pluginManagement>` so we always use what we tested. |
| G5 | `palantirJavaFormat` step is **incompatible** with `cleanthat` (both manipulate imports) | We don't enable cleanthat; no risk. |
| G6 | Lefthook `stage_fixed` only works on `pre-commit`; `pre-push` runs a final `git status` but doesn't re-add | We put the apply on `pre-commit` and the check on `pre-push`; this is the correct split. |
| G7 | The Palantir `checkstyle.xml` references `${config_loc}/checkstyle-suppressions.xml`. `config_loc` resolves to the directory of the resolved `configLocation`. | We place both files in the same dir (`build-tools/checkstyle/`); this just works. If we ever move suppressions elsewhere, we must update the `SuppressionFilter` `file` property. |
| G8 | The Palantir `checkstyle.xml` references `${config_loc}/custom-suppressions.xml` as **optional** (property `optional="true"`). | We can simply not create it, or create an empty one in `build-tools/checkstyle/`. Either works. |
| G9 | `palantir-java-format-spi` is a transitive dependency — published on Maven Central, not an internal artifact. | No repository configuration needed. |
| G10 | The Palantir `checkstyle.xml` has a `<module name="BeforeExecutionExclusionFileFilter">` excluding `module-info.java`. | No action needed; we don't have `module-info.java` in this multi-module Maven project (no JPMS). |
| G11 | `palantirJavaFormat` is line-ending-sensitive. After first apply, all `.java` files become LF. | This matches `NewlineAtEndOfFile lineSeparator=lf` in `checkstyle.xml` — consistent. |
| G12 | `mvn spotless:apply` rewrites the working tree but does **not** `git add` — the lefthook `stage_fixed: true` handles that. | Verified via lefthook docs: `stage_fixed` automatically detects modified files and stages them. |
| G13 | `palantir-java-format` formatting is "trusted projects only" since 2.92.0 (PR #1681). | We are in a trusted local repo; no action needed. |
| G14 | Lombok-generated code (e.g. `@Slf4j`, `@Getter`) runs through palantir-java-format fine but **does not** run through checkstyle if generated sources are excluded. | Spotless handles generated Lombok correctly. Checkstyle's `MethodLength` etc. run against Lombok-generated bytecode-less source; that's intended. |
| G15 | `palantir-java-format`'s `style` option accepts `PALANTIR` (default) / `AOSP` / `GOOGLE`. PALANTIR matches the team's intent; explicit declaration prevents accidental drift. | Set `<style>PALANTIR</style>` in the config. |
| G16 | The `RegexpSinglelineJava` check for `printStackTrace` and `System.out` / `System.err` will fail any legacy `System.out.println` in the codebase. | Include `BanSystemOut|BanSystemErr|IllegalTokenText` in the per-module suppressions if legacy code has these (per `regulatory`-style detection). |
| G17 | `palantir-java-format` 2.92.0 is built with Guava 33.6.0-jre which transitively requires `failureaccess:1.0.3`. Spotless pulls these for us. | No explicit `<dependency>` needed. |
| G18 | Plugin executions inherited from `<pluginManagement>` of parent POM only run if children actually declare the plugin in their `<build><plugins>`. | Use Option B (declare in parent's `<build><plugins>`, not `<pluginManagement>`) to avoid touching every child pom. |
| G19 | If `<failOnViolation>` is true and we suppress a check at severity `info` or `warning`, it still doesn't fail the build. Our severity is `error` across the board. | R10 + `violationSeverity=error` line up correctly. |
| G20 | **Test source directory should be checked too**. The default for maven-checkstyle-plugin 3.x is `includeTestSourceDirectory=false`; we must set it to true (R9). | Explicit `<includeTestSourceDirectory>true</includeTestSourceDirectory>`. |

---

## Source URLs (consolidated)

| Topic | URL |
|---|---|
| Spotless Maven plugin docs | https://github.com/diffplug/spotless/blob/main/plugin-maven/README.md |
| Spotless CHANGES | https://github.com/diffplug/spotless/blob/main/plugin-maven/CHANGES.md |
| Spotless Maven Central | https://central.sonatype.com/artifact/com.diffplug.spotless/spotless-maven-plugin |
| palantir-java-format repo | https://github.com/palantir/palantir-java-format |
| palantir-java-format 2.92.0 release | https://github.com/palantir/palantir-java-format/releases/tag/2.92.0 |
| palantir-java-format Maven Central | https://central.sonatype.com/artifact/com.palantir.javaformat/palantir-java-format |
| gradle-baseline repo (checkstyle source) | https://github.com/palantir/gradle-baseline |
| Palantir checkstyle.xml (raw, develop) | https://raw.githubusercontent.com/palantir/gradle-baseline/develop/gradle-baseline-java-config/resources/checkstyle/checkstyle.xml |
| Palantir checkstyle.xml (raw, tag 7.5.0) | https://raw.githubusercontent.com/palantir/gradle-baseline/7.5.0/gradle-baseline-java-config/resources/checkstyle/checkstyle.xml |
| Palantir checkstyle-suppressions.xml (develop) | https://raw.githubusercontent.com/palantir/gradle-baseline/develop/gradle-baseline-java-config/resources/checkstyle/checkstyle-suppressions.xml |
| maven-checkstyle-plugin repo | https://github.com/apache/maven-checkstyle-plugin |
| maven-checkstyle-plugin 3.6.0 tag | https://github.com/apache/maven-checkstyle-plugin/tree/maven-checkstyle-plugin-3.6.0 |
| maven-checkstyle-plugin Maven Central | https://central.sonatype.com/artifact/org.apache.maven.plugins/maven-checkstyle-plugin |
| Spring Boot 4.0.7 BOM (local) | `~/.m2/repository/org/springframework/boot/spring-boot-dependencies/4.0.7/spring-boot-dependencies-4.0.7.pom` |
| Lefthook config docs | https://lefthook.dev/configuration/ |
| Lefthook stage_fixed example | https://lefthook.dev/examples/stage_fixed/ |
| Lefthook filters (glob) example | https://github.com/evilmartians/lefthook/blob/master/docs/examples/filters.md |
| Lefthook stage_fixed source | https://github.com/evilmartians/lefthook/blob/master/docs/examples/stage_fixed.md |

---

## Caveats / Not Found

- **Spring Boot 4.0.7 docs URL `https://docs.spring.io/spring-boot/docs/4.0.7/reference/htmlsingle/` returned 404** at the time of research. The Spring Boot reference docs page may have been reorganized; the cached BOM in `~/.m2/.../spring-boot-dependencies-4.0.7.pom` is the authoritative source for the plugin-management table.
- **Palantir `custom-suppressions.xml` does not exist** in the upstream repo. The reference in `checkstyle.xml` has `optional="true"`, so it's safe to omit (or create empty).
- **`<ratchetFrom>`** is intentionally **not** enabled in the recommended template (PRD explicitly defers ratcheting).
- **`palantir-native` formatter** (native-image variant) is only used when Gradle daemon / project SDK is Java 21+; we are on Java 17, so we'll always use the JVM implementation (slightly slower for first invocation but correct).
- The exact **list of failing checks in the existing 4 modules** can only be known after `mvn checkstyle:check` is run once against the unmodified codebase — that scan must happen in the implement phase, not before.