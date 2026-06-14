# schema v5: 字段精简与日志表扩充

## Goal

将 `backend/db/schema.sql` 从 v4 升级到 v5,完成以下结构性调整:

1. `sys_user` 移除 `dept_id`(原 DEPT 类数据权限锚点改由 `sys_data_permission` 承担)
2. 4 张表移除 `description` 字段,统一只保留 `remark`
3. `api_log` 字段扩充对齐 PostgreSQL `sys_api_log` 风格(客户端指纹 / UA 解析 / IP 解析 / 变更前后 / 请求头)
4. `login_log` 字段扩充对齐 PostgreSQL `sys_login_log` 风格(同上 + MAC / 状态码 / 客户端指纹)
5. 同步更新 `api_log_archive` / `login_log_archive`(归档表与热表同结构)
6. 同步更新 3 份配套文档(`docs/tables.md` / `docs/er.md` / `docs/db-conventions.md`)到 v5

## Context

- 上一任务 `06-14-admin-db-design` 已完成 v3→v4 的 `deleted_at` 软删改造,本任务是其延续。
- 任务起点: `schema.sql` v4 (22 张表) + `docs/` v4+ 配套文档。
- 任务终点: `schema.sql` v5 (22 张表,内容变更) + `docs/` v5+ 配套文档。
- 任务以"参考 PostgreSQL 现有日志表"为完善方向,不重做 ER 关系。

## Requirements

### R1: `sys_user` 移除 `dept_id`

- 移除 `dept_id BIGINT UNSIGNED DEFAULT NULL` 列
- 移除 `INDEX idx_sys_user_dept_id (dept_id)` 索引
- 更新文件头 `NULL 策略` 段,删除 `dept_id` 软外键说明
- 同步更新 `docs/tables.md` (1.1 `sys_user` 表) 和 `docs/db-conventions.md` (§7.2 软外键清单)
- 同步更新 `docs/er.md` (§3 软引用清单)

### R2: 4 张表移除 `description`

- 涉及表:
  - `sys_role` (Section 3)
  - `sys_api` (Section 4)
  - `dict_type` (Section 7)
  - `temporal_task_config` (Section 8)
- 移除 `description VARCHAR(255) NOT NULL DEFAULT ''` 列
- 保留 `remark VARCHAR(512) NOT NULL DEFAULT ''` 列
- 同步更新 `docs/tables.md` 对应表段

### R3: `api_log` 字段扩充(对齐 PG `sys_api_log`)

新增字段 (与 PG 一一对应):

- `method VARCHAR(16) NOT NULL` ← 重命名自 `request_method VARCHAR(8)`
- `module VARCHAR(255) NOT NULL DEFAULT ''` ← 放宽 64→255
- `path VARCHAR(255) NOT NULL` ← 重命名自 `request_path`
- `status_code INT UNSIGNED DEFAULT NULL` ← 重命名自 `response_status SMALLINT UNSIGNED`
- `success TINYINT(1) NOT NULL DEFAULT 0` ← 新增(2xx 判定)
- `reason VARCHAR(255) NOT NULL DEFAULT ''` ← 替换 `error_message`
- `cost_time BIGINT UNSIGNED NOT NULL DEFAULT 0` ← 重命名自 `duration_ms INT UNSIGNED` 并改类型
- `request_id VARCHAR(128) NOT NULL` ← 放宽 64→128
- `sys_user_id BIGINT UNSIGNED DEFAULT NULL` ← 重命名自 `user_id`
- `request_uri TEXT NOT NULL DEFAULT ''` ← 新增
- `request_header MEDIUMTEXT NOT NULL DEFAULT ('')` ← 新增
- `referer VARCHAR(2048) NOT NULL DEFAULT ''` ← 新增
- `response MEDIUMTEXT NOT NULL DEFAULT ('')` ← 重命名自 `response_body`
- `before_change MEDIUMTEXT NOT NULL DEFAULT ('')` ← 新增
- `after_change MEDIUMTEXT NOT NULL DEFAULT ('')` ← 新增
- `format_change TEXT NOT NULL DEFAULT ''` ← 新增
- `client_id VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `client_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `client_ip VARCHAR(64) NOT NULL DEFAULT ''` ← 放宽 45→64
- `user_agent TEXT NOT NULL DEFAULT ''` ← 放宽 VARCHAR(512)→TEXT
- `browser_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `browser_version VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `os_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `os_version VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `location VARCHAR(255) NOT NULL DEFAULT ''` ← 新增

移除字段:

- `request_method` (重命名为 `method`)
- `request_path` (重命名为 `path`)
- `response_status` (重命名为 `status_code`)
- `duration_ms` (重命名为 `cost_time`)
- `user_id` (重命名为 `sys_user_id`)
- `response_body` (重命名为 `response`)
- `error_message` (由 `reason` 替代)

索引调整:

- `UNIQUE KEY uniq_api_log_request_id (request_id)` 保留
- `idx_api_log_user_id_created_at` → `idx_api_log_sys_user_id_created_at (sys_user_id, created_at)`
- `idx_api_log_user_module_created_at` → `idx_api_log_module_created_at (module, created_at)`
- `idx_api_log_request_path_created_at` → `idx_api_log_path_created_at (path, created_at)`
- `idx_api_log_response_status_created_at` → `idx_api_log_status_code_created_at (status_code, created_at)`
- 新增 `idx_api_log_success_created_at (success, created_at)`
- 新增 `idx_api_log_client_ip_created_at (client_ip, created_at)`

### R4: `login_log` 字段扩充(对齐 PG `sys_login_log`)

新增/重命名字段:

- `username VARCHAR(64) NOT NULL DEFAULT ''` (加默认,与 PG 对齐)
- `success TINYINT(1) NOT NULL DEFAULT 0` (加默认)
- `reason VARCHAR(255) NOT NULL DEFAULT ''` ← 重命名自 `failure_reason`
- `status_code INT UNSIGNED DEFAULT NULL` ← 新增
- `sys_user_id BIGINT UNSIGNED DEFAULT NULL` ← 重命名自 `user_id`
- `login_method VARCHAR(32) NOT NULL DEFAULT 'PASSWORD'` 保留
- `login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` ← 新增(与 created_at 区分)
- `login_ip VARCHAR(64) NOT NULL DEFAULT ''` ← 重命名自 `client_ip`
- `login_mac VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `client_id VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `client_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `user_agent TEXT NOT NULL DEFAULT ''` ← 放宽 VARCHAR(512)→TEXT
- `browser_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `browser_version VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `os_name VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `os_version VARCHAR(128) NOT NULL DEFAULT ''` ← 新增
- `location VARCHAR(255) NOT NULL DEFAULT ''` ← 新增

移除字段 (由新结构替代):

- `failure_reason` (重命名为 `reason`)
- `user_id` (重命名为 `sys_user_id`)
- `client_ip` (重命名为 `login_ip`)
- `device VARCHAR(32) DEFAULT NULL`
- `os VARCHAR(64) DEFAULT NULL` (由 `os_name` + `os_version` 替代)
- `browser VARCHAR(64) DEFAULT NULL` (由 `browser_name` + `browser_version` 替代)
- `country VARCHAR(64) DEFAULT NULL`
- `province VARCHAR(64) DEFAULT NULL`
- `city VARCHAR(64) DEFAULT NULL` (由 `location` 替代)

索引调整:

- 保留 `idx_login_log_username_created_at (username, created_at)`
- 保留 `idx_login_log_success_created_at (success, created_at)`
- `idx_login_log_user_id` → `idx_login_log_sys_user_id (sys_user_id)`
- 新增 `idx_login_log_login_ip_created_at (login_ip, created_at)`
- 新增 `idx_login_log_login_time (login_time)`

### R5: 归档表同步

- `api_log_archive` 结构与 `api_log` 一致,加 `archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `login_log_archive` 结构与 `login_log` 一致,加 `archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- 保留 `created_at` 原始时间(便于跨表查询)
- 保留 `UNIQUE KEY` on `request_id`(供 api_log_archive)

### R6: 文档同步

- `docs/tables.md`:头部 `(v4+)` → `(v5+)`;逐表字段表全部更新;`api_log_archive` / `login_log_archive` 段加 v5+ 引用注释
- `docs/er.md`:头部 `(v4+)` → `(v5+)`;§3 软引用清单移除 `dept_id` 行,`user_id` → `sys_user_id`(注 `operation_log` 仍为 `user_id`)
- `docs/db-conventions.md`:头部 `(v4+)` → `(v5+)`;§6.2 索引模式更新;§7.2 软外键表更新;§9 JSON 字段约定更新;§11.1 日志关键字段更新;§11.5 性能约束索引更新

### R7: 文件头版本与改动说明

- `schema.sql` 文件头 v4 → v5
- 在文件头新增 "v5 相对 v4 的改动" 段,分 5 条说明本次所有变更
- 调整 `NULL 策略` 段(删 `dept_id`、改 `failure_reason` → `reason` 引用)
- 末尾注释 `End of schema.sql (v2)` → `(v5)`

## Constraints

- 保持 22 张表的数量不变(只改内容,不改数量)
- 保持 `utf8mb4_0900_ai_ci` 排序规则
- 保持 `InnoDB` 引擎
- 保持 `soft-delete-aware UNIQUE(col, deleted_at)` 模式不受影响
- 保持自引用 FK (`sys_menu.parent_id`, `sys_role.parent_id`) ALTER 后置的现有约定
- `operation_log` / `temporal_task_execution` / 4 张关联表 (`sys_user_role` / `sys_role_api` / `sys_role_menu` / `sys_menu_api`) **不在本次变更范围**
- 文档改动严格跟随 schema,不改 `er.md` 的 ASCII ER 图(图中没有字段级细节,无需改)

## Out of Scope

- 后端 ingestion 中间件 (Go / Java AOP) 的字段映射调整
- 现有数据迁移 (v4 → v5 假定生产环境无数据;若有数据,需另写迁移脚本)
- Casbin 策略 / Casbin adapter
- 任何 ORM entity / repository 代码
- Seed / fixture 数据

## Acceptance Criteria

- [ ] `schema.sql` 第 1-30 行文件头正确标记为 v5 且包含"v5 相对 v4 的改动" 5 条说明
- [ ] `schema.sql` 仍为 22 张 `CREATE TABLE` 语句
- [ ] `schema.sql` 末尾标记为 `(v5)`
- [ ] `sys_user` 表无 `dept_id` 列、无 `idx_sys_user_dept_id` 索引
- [ ] 4 张表 (`sys_role` / `sys_api` / `dict_type` / `temporal_task_config`) 无 `description` 列
- [ ] `api_log` 表含全部新字段(对照 R3 列表),字段命名与索引名与 R3 一致
- [ ] `api_log_archive` 结构与 `api_log` 一致(多 `archived_at`)
- [ ] `login_log` 表含全部新字段、移除全部旧字段(对照 R4 列表),与 `api_log` 风格一致
- [ ] `login_log_archive` 结构与 `login_log` 一致(多 `archived_at`)
- [ ] `docs/tables.md` 头部为 `(v5+)` 且逐表字段表全部与 schema 对齐
- [ ] `docs/er.md` 头部为 `(v5+)` 且 §3 软引用清单无 `dept_id` 行
- [ ] `docs/db-conventions.md` 头部为 `(v5+)` 且 §6.2 / §7.2 / §9 / §11.1 / §11.5 与 schema 对齐
- [ ] git 提交包含上述 4 个文件,且仅包含这 4 个文件
- [ ] 工作区剩余 untracked 仅为 `apps/vue-vben-admin/`(其他窗口工作,不在本任务范围)

## Notes

- 本次任务以"对照 PG 风格完善"为方向,实际 PG schema 是软参考;MySQL 端的字段命名 / 类型 / 默认值做了适配(如 `bigint` → `BIGINT UNSIGNED`, `boolean` → `TINYINT(1)`, `text` → `TEXT` 或 `MEDIUMTEXT` 视用途)。
- 任务以"补建 Trellis 任务"的方式启动:实施已经在会话内完成,本任务文档是回顾性记录。
- 任务在 `feat/admin-db-design` 分支上,base 是 `06-14-admin-db-design` 任务结束后的快照(`6ecf311`)。
