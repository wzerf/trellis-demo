# schema v5 Implement

## 1. 实施概览

本任务在会话内已**实际完成实施**(`backend/db/schema.sql` + `docs/*.{md,sql}` 4 个文件已修改)。
本 `implement.md` 是回顾性记录,描述实际采用的实施步骤和决策。

## 2. 实施策略

### 2.1 不走完整 Trellis 流程的实施

- 用户在会话开始时明确选择"不创建任务,直接改 schema.sql"。
- 因此实施采用**直接编辑**策略,跳过 task.py start。
- 实施完成后,用户改主意,要求"补上 Trellis 任务后再 finish-work",所以本任务以**回顾性方式**创建 task + 写产物。

### 2.2 编辑策略:Targeted Edit,不用 Write

- `schema.sql` 643 行,涉及 8 个表(Section 2/3/4/7/8/16/17/18/19)。
- 用 `Edit` 工具做 11 处定点替换(每个 Section 一次,文件头一次,末尾一次),而不是整文件 `Write`。
- 优点:降低误改其他无关 Section 风险;可逐步验证;diff 干净。
- 缺点:每处 Edit 都要提供唯一 oldString;若某段结构复杂(像 api_log),oldString 较长。

## 3. 实施清单(按实际执行顺序)

### 3.1 文件头更新(Edit 1)

- `schema.sql` 第 1-31 行整体替换
- 内容:v4 → v5
- 新增 "v5 相对 v4 的改动" 5 条说明
- 调整 `NULL 策略` 段

### 3.2 Section 2: `sys_user` 移除 `dept_id`(Edit 2)

- 移除 `dept_id BIGINT UNSIGNED DEFAULT NULL` 列
- 移除 `INDEX idx_sys_user_dept_id (dept_id)` 索引
- 段注释加 v5 改动说明
- 文件头 `NULL 策略` 段同步删 `dept_id`

### 3.3 4 张表移除 `description`(Edit 3-6, 并行)

- Section 3 `sys_role`: 删 `description` 列,段注释加 v5 说明
- Section 4 `sys_api`: 删 `description` 列,段注释加 v5 说明
- Section 7 `dict_type`: 删 `description` 列,段注释加 v5 说明
- Section 8 `temporal_task_config`: 删 `description` 列,段注释加 v5 说明

### 3.4 Section 16-17: `api_log` + `api_log_archive` 重写(Edit 7-8, 串行)

- `api_log`: 一次性替换整个 `CREATE TABLE` 块
  - 新增 18 字段 + 重命名 7 字段 + 放宽 4 字段 + 移除 1 字段
  - 索引 5 → 7 (改名 3 + 新增 2)
  - 段注释加 v5 完整说明
- `api_log_archive`: 镜像 api_log 结构
  - 加 `archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - 保留所有新字段

### 3.5 Section 18-19: `login_log` + `login_log_archive` 重写(Edit 9-10, 串行)

- `login_log`: 一次性替换整个 `CREATE TABLE` 块
  - 新增 11 字段 + 重命名 3 字段 + 放宽 1 字段 + 移除 6 字段 (`device` / `os` / `browser` / `country` / `province` / `city`)
  - 索引 3 → 5 (改名 1 + 新增 2)
  - 段注释加 v5 完整说明
- `login_log_archive`: 镜像 login_log 结构
  - 加 `archived_at`
  - 保留所有新字段

### 3.6 末尾版本(Edit 11)

- `End of schema.sql (v2)` → `(v5)`

### 3.7 文档同步(Edit 12-23, 串行)

- `docs/tables.md`:
  - 头部 `(v4+)` → `(v5+)`
  - 1.1 `sys_user` 表:删 `dept_id` 行 + `idx_dept_id` 引用
  - 1.2 `sys_role` 表:删 `description` 行
  - 2.1 `sys_api` 表:删 `description` 行
  - 5.1 `dict_type` 表:删 `description` 行
  - 7.1 `api_log` 表:整体重写(28 字段 + 7 索引)
  - 7.2 `api_log_archive`:加 v5+ 引用注释
  - 7.3 `login_log` 表:整体重写(20 字段 + 5 索引 + 移除说明)
  - 7.4 `login_log_archive`:加 v5+ 引用注释
  - 8.1 `temporal_task_config` 表:删 `description` 行

- `docs/er.md`:
  - 头部 `(v4+)` → `(v5+)`
  - §3 软引用清单:删 `dept_id` 行,`user_id` → `sys_user_id` (注 operation_log 不变)

- `docs/db-conventions.md`:
  - 头部 `(v4+)` → `(v5+)`
  - §6.2 索引模式:`user_id` → `sys_user_id` / `response_status` → `status_code`
  - §7.2 软外键表:删 `dept_id` 行,`user_id` → `sys_user_id`
  - §9 JSON 字段:`api_log.response_body` → `api_log.response`
  - §11.1 日志关键字段:`failure_reason` → `reason`,`client_ip` → `login_ip`,加 `status_code`
  - §11.5 索引示例:全套更新

## 4. 决策记录

### 4.1 为什么 `success` 字段用 `TINYINT(1)` 而不是 BOOLEAN

- MySQL 没有原生 BOOLEAN;`BOOLEAN` 是 `TINYINT(1)` 的别名。
- 现有项目所有布尔字段用 `TINYINT(1) NOT NULL DEFAULT 0`,保持一致。

### 4.2 为什么 `cost_time` 用 `BIGINT UNSIGNED` 而不是 `INT UNSIGNED`

- PG 用 `bigint`;沿用 PG 风格留余量(BIGINT 上限 ~584K 年毫秒,实际不会触及)。
- 同时 `api_log` 是写入密集型,避免 `INT UNSIGNED` 在极慢请求(>49 天)下溢出。

### 4.3 为什么 `login_log` 删除 `country` / `province` / `city` 三段

- PG 风格用单一 `location` 字段表达地理位置,格式自由(如 "中国/北京/北京" 或 "116.4,39.9")。
- 减少字段数量,降低应用层 IP 解析拼接复杂度。
- 应用层可选择输出三段式字符串(填入 `location`),无需 DB schema 强制。

### 4.4 为什么保留 `login_log.login_method`

- PG schema 没有 `login_method`,但 `login_method` 是真实的业务区分(PASSWORD/SSO/OAUTH/SMS)。
- 不在本次调整范围,保留。

### 4.5 为什么 `before_change` / `after_change` 用 `MEDIUMTEXT` 而不是 JSON

- 数据快照大小不可控,JSON 字段在 MySQL 有大小限制(实际值大小受 `max_allowed_packet` 约束)。
- `MEDIUMTEXT` 16MB 容量充裕,应用层负责 JSON 序列化(若需要)。
- 也可改用 `JSON` 类型,但失去"原样存文本"能力(如需存 SQL 字符串或 HTML 片段)。

### 4.6 为什么归档表保留 `created_at` 原始时间

- `created_at` 是热表写入时刻,记录在归档表中。
- 业务分析需要"按 created_at 跨热表/归档表统一查询",所以归档表必须有原始 `created_at`。
- `archived_at` 是归档执行时刻,独立记录。

## 5. 验证步骤

### 5.1 语法验证(完成)

```bash
# schema.sql 22 张表
grep -c "^CREATE TABLE" backend/db/schema.sql
# 应输出 22

# 文件头 v5
head -1 backend/db/schema.sql
# 应输出 "MySQL Schema  (v5)"

# 末尾 v5
tail -3 backend/db/schema.sql
# 应包含 "End of schema.sql (v5)"
```

### 5.2 字段验证(完成)

```bash
# sys_user 不应有 dept_id
grep "dept_id" backend/db/schema.sql
# 应只在文件头"v5 改动"段和段注释中出现

# 4 张表不应有 description 列
grep "description" backend/db/schema.sql
# 应只在文件头"v5 改动"段和段注释中出现

# api_log / login_log 关键字段应有
grep "cost_time" backend/db/schema.sql
grep "sys_user_id" backend/db/schema.sql
# 都应输出多行
```

### 5.3 跨文档一致性验证(完成)

```bash
# docs/tables.md 应与 schema 字段一致
grep -E "sys_user_id|method|path\b" backend/db/docs/tables.md
# 应输出多行

# docs/er.md 软引用表应无 dept_id
grep "dept_id" backend/db/docs/er.md
# 应只输出 v5 改动说明中的引用(已确认 0 命中)

# docs/db-conventions.md 索引模式应使用新字段名
grep -E "sys_user_id|status_code" backend/db/docs/db-conventions.md
# 应输出多行
```

### 5.4 完整性扫描(完成)

```bash
# schema.sql 内部对 v4 旧字段的引用,应在 v5 改动说明 / 段注释中(预期内)
# 不应在 `CREATE TABLE` 块内
```

## 6. 未做(明确 out of scope)

- 应用层 ingestion 代码 (Go / Java AOP):本任务无 `apps/` 下 admin 后端代码
- 数据迁移脚本:假定生产无数据
- Seed 数据
- Casbin policy

## 7. Review 闸门(回顾)

- [x] schema.sql 22 张表数量不变
- [x] 4 张表 description 全部移除
- [x] sys_user dept_id 移除 + 索引移除
- [x] api_log 字段与 PG 对齐
- [x] api_log_archive 与 api_log 同结构
- [x] login_log 字段与 PG 对齐
- [x] login_log_archive 与 login_log 同结构
- [x] 3 份 docs 同步到 v5
- [x] 文件头 v5 改动说明完整
- [x] 末尾版本号 v5

## 8. 提交计划(Phase 3.4)

- 单次 commit 包含 4 个文件:
  - `backend/db/schema.sql` (modified)
  - `backend/db/docs/tables.md` (modified)
  - `backend/db/docs/er.md` (modified)
  - `backend/db/docs/db-conventions.md` (modified)
- 提交信息:`feat(db): schema v5 字段精简与日志表扩充(对齐 PG 风格)`
- 不应包含: `apps/vue-vben-admin/` (其他窗口工作)
- 不应包含: `.trellis/workspace/wshake/` (skill 自身产物)
- 不应包含: `.trellis/tasks/06-14-06-14-schema-v5/` (回顾性 task 产物,单独 commit)
