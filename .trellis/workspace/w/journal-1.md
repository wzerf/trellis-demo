# Journal - w (Part 1)

> AI development session journal
> Started: 2026-06-13

---

- Trellis 已开启

## 2026-06-14 — java-admin-backend Phase 3 收尾

**任务**：`06-14-java-admin-backend`（archive 至 `.trellis/tasks/archive/2026-06/06-14-java-admin-backend/`）

### Phase 3 收尾动作

1. **验证质量门**
   - `mvn test` 跑通全部 40 个测试，0 failure（用户修改 `application-dev.yaml` 后仍绿）
   - `mvn package` + e2e 全通：login (200, code=0, token 36 字符) → info (200) → logout (200)
   - 无 token info → 401（Sa-Token 兜底）
2. **Spec 落盘（8 份规范）**
   - 新写：`infra-nacos.md`（Nacos 0.2.2+ starter 完整规范）、`infra-flyway.md`（手动 `FlywayMigrator` 模板）、`infra-docker-compose.md`（4000 段端口策略）
   - 重写：`directory-structure.md`（4 模块依赖图）、`database-guidelines.md`（Easy-Query 3.2.12 SB 4 专用）、`logging-guidelines.md`（Logback `%clr` 踩坑）、`error-handling.md`（双模式 + 3 字段严格）
   - 新写：`quality-guidelines.md`（验收清单 + 40 测试分布）
   - 更新：`prd.md` Tech Stack 表格 + Notes（13 决策 + 11 启动坑）
3. **归档**：`.trellis/tasks/06-14-java-admin-backend/` → `archive/2026-06/06-14-java-admin-backend/`
4. **task.json 标记 `completed` + `completedAt=2026-06-14`**

### 关键产出

- 4 模块 Maven 工程（`com.wshake.{common,service,infra,api}`）
- 40 单测 + 1 e2e 验证
- 1 个数据库表（`sys_user`）+ V1 建表 + V2 dev 种子
- 1 个可插拔的 Nacos Config 集成（`@ConditionalOnProperty`）
- 1 个 docker-compose（MySQL 8.4 + Redis 7 + Nacos 2.4.3 + Adminer）
- 1 个 traceId 全链路追踪（Filter + MDC + 响应头）

### 下次启动前提醒

- 跑 `vp install`（Vite+ 提示，本项目是 Maven 而非 Vite+，可忽略）
- 跑 `mvn test` 一次确认还绿
- 起应用前：先 `docker compose up -d`，再 `mvn spring-boot:run`
- 改 Nacos 配置前：先确认 `NACOS_CONFIG_ENABLED` 当前是 true/false（影响改哪里）

---

## 2026-06-15 — `vp check` 与 pre-commit 拆分 vue-vben-admin

**问题**：根目录 `vp check` 报 1466 个文件含 vue-vben-admin（它有自己的 `oxfmt` / `oxlint` / `lefthook`），两套规则混用；用户认为 pre-commit 没有 `--fix`（实际是 staged 配置里隐式 `vp check --fix`，不直观）。

**改动**（2 个文件）：

- `vite.config.ts`：
  - `fmt` / `lint` 加 `ignorePatterns: ["apps/vue-vben-admin/**", "apps/vue-vben-admin"]` → 根 `vp check` 不再扫 vue-vben-admin（1466 → 163 文件）。
  - `staged` 改成 lint-staged 函数式任务，自行过滤 vue-vben-admin 后再 `pnpm exec vp check --fix` 拼好 shell-quoted 路径。**关键点**：lint-staged 把函数返回的 `string[]` 当作多个独立 command 跑（不是 argv），必须返回**单条**带引号的命令字符串。
- `lefthook.yml`：把 `staged` 段注释改成显式说明 `--fix` 来自 vite.config.ts 的函数式 staged 任务，作用域仅根 workspace。

**验证**：

- `vp check` 报 163 个文件，无 `apps/vue-vben-admin/**`。
- `pnpm exec vp staged` 在根 workspace 文件 + vue-vben-admin 文件同时 stage 时，只对前者执行 `vp check --fix`，后者被过滤。
- 单独 stage vue-vben-admin 文件时，lint-staged 报 "could not find any staged files"（因为 git 把该目录当 submodule，160000 模式被 `getStagedFiles` 过滤），无需函数兜底。

**遗留 / 可选**：

- `apps/vue-vben-admin/lefthook.yml` 里 `pnpm lint`（`vsh lint`）无 `--fix`，如需提交时自动格式化可改 `pnpm format`（`vsh lint --format`）。本次未动。
- 根 `vp check` 仍有 163 个文件待 `--fix`，未自动执行（避免大改）。

### 后续：pre-push 加 `full-check`

- `lefthook.yml` 的 `pre-push` 加 `full-check: pnpm exec vp check --fix`。
- 作用：pre-commit 只动 staged 文件（`vp staged`），pre-push 做全 workspace 兜底——捕获走 `--no-verify`、未 stage 的修改。
- `apps/vue-vben-admin/**` 已被 `vite.config.ts` 的 `ignorePatterns` 排除，子模块由自己的 hook 接管。
- 注意：`--fix` 在 push 时改的是工作树，已 commit 的内容不变；用户应在 hook 退出后看 diff 决定是否补一个 fixup commit。如要 hard-fail-only，去掉 `--fix` 即可。
