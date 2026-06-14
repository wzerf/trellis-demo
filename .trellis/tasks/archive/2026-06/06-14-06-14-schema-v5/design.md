# schema v5 Design

## 1. 设计动机

### 1.1 为什么移除 `sys_user.dept_id`

- `dept_id` 在 v3 加入时定位为 "DEPT 类数据权限查询锚点"。
- 实际上 v4 已引入 `sys_data_permission` 作为通用的行级数据权限机制(ABAC)。
- `sys_data_permission` 的 `scope_field` 已经是配置化(默认 `id`,可改成 `dept_id`),不需要在 `sys_user` 上预设 `dept_id` 锚点。
- 移除 `dept_id` 避免 `sys_user` 隐式绑定一张未建表 (`sys_dept`) 的事实,减少 ER 图噪音。
- 业务侧仍可经 `sys_data_permission.scope_field = 'dept_id'` + `scope_values = [1, 2, 3]` 表达 DEPT 范围。

### 1.2 为什么 4 张表移除 `description`

- `description` 与 `remark` 长期共存造成语义混淆:`description` 偏"业务描述" / `remark` 偏"管理员备注"。
- 实际使用上,管理后台的"描述"输入框大多存的是管理员备注(运维 / 临时说明),与 `remark` 重合。
- 统一为 `remark` 后,字段语义清晰,减少"填哪儿都对/都不对"的歧义。
- 数据可丢失风险:`description` 字段已存在数据;v4→v5 假定生产无数据(新部署);若有数据需另写迁移 `ALTER TABLE ... DROP COLUMN description`。

### 1.3 为什么 `api_log` 字段扩充对齐 PG

- 现有 `api_log` 字段不足以支撑"全链路审计"诉求:
  - 缺少 `referer` / `user_agent` 解析(浏览器 / OS)
  - 缺少客户端指纹(`client_id` / `client_name`)区分 web / mobile / 小程序
  - 缺少 IP 地理 `location`
  - 缺少 `format_change` / `before_change` / `after_change` 表达写操作的差异
  - 业务成功失败仅靠 `response_status` 推断;新增 `success` 显式表达"业务级成功"
- PG `sys_api_log` 已有完整的"客户端 + 请求 + 响应 + 变更"全量字段;对齐后:
  - 应用层 ingestion 逻辑收敛(无歧义)
  - 索引可直接命中高频查询路径(成功失败分析 / 模块分析 / IP 热点)
  - 字段命名与 PG 一致,降低未来跨库迁移成本

### 1.4 为什么 `login_log` 字段扩充对齐 PG

- 现有 `login_log` 用 `os` / `browser` / `country` / `province` / `city` 5 个独立字段表达"客户端 + 地理位置",但都只有名字没有版本,且 `country` / `province` / `city` 三段式需要应用层做 IP 解析拼接。
- PG `sys_login_log` 用 `os_name` + `os_version` + `browser_name` + `browser_version` 表达更细粒度;用单一 `location` 字段表达地理位置(应用层可填 `中国/北京/北京` 或经纬度,格式自由)。
- 减少字段数量:从 12 个客户端相关字段收敛到 8 个(`client_*` ×2 + `user_agent` + `os_*` ×2 + `browser_*` ×2 + `login_mac`)。
- 新增 `status_code` 显式记录 HTTP 状态码,便于登录失败分类(401/403/429 等)。
- 新增 `login_time` 与 `created_at` 区分:同步上报时相同,异步上报时 `login_time` 是登录尝试时刻,`created_at` 是入库时刻。

## 2. 字段映射表(PG → MySQL)

### 2.1 `api_log` 字段映射

| PG `sys_api_log`                      | MySQL `api_log` v5                                        | 转换说明                                            |
| ------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `id bigint`                           | `id BIGINT UNSIGNED AUTO_INCREMENT`                       | 主流 MySQL 主键策略                                 |
| `created_at timestamp with time zone` | `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | MySQL TIMESTAMP 无 TZ,但写入 / 读取统一走 server TZ |
| `request_id varchar(128)`             | `request_id VARCHAR(128) NOT NULL`                        | 与 PG 一致                                          |
| `method varchar(16)`                  | `method VARCHAR(16) NOT NULL`                             | 与 PG 一致                                          |
| `module varchar(255)`                 | `module VARCHAR(255) NOT NULL DEFAULT ''`                 | 与 PG 一致                                          |
| `path varchar(255)`                   | `path VARCHAR(255) NOT NULL`                              | 与 PG 一致                                          |
| `referer text`                        | `referer VARCHAR(2048) NOT NULL DEFAULT ''`               | URL 通常 < 2KB,用 VARCHAR 限长                      |
| `before_change text`                  | `before_change MEDIUMTEXT NOT NULL DEFAULT ('')`          | 数据快照可能很大,MEDIUMTEXT 16MB                    |
| `after_change text`                   | `after_change MEDIUMTEXT NOT NULL DEFAULT ('')`           | 同上                                                |
| `format_change text`                  | `format_change TEXT NOT NULL DEFAULT ''`                  | 人读摘要,64KB 内足够                                |
| `request_uri text`                    | `request_uri TEXT NOT NULL DEFAULT ''`                    | 完整 URI,含 query,可能较长                          |
| `request_body text`                   | `request_body MEDIUMTEXT NOT NULL DEFAULT ('')`           | 应用层截断 64KB                                     |
| `request_header text`                 | `request_header MEDIUMTEXT NOT NULL DEFAULT ('')`         | 头信息(可能含 cookie)较大                           |
| `response text`                       | `response MEDIUMTEXT NOT NULL DEFAULT ('')`               | 应用层截断 64KB                                     |
| `cost_time bigint`                    | `cost_time BIGINT UNSIGNED NOT NULL DEFAULT 0`            | 毫秒数,BIGINT 够用                                  |
| `sys_user_id bigint`                  | `sys_user_id BIGINT UNSIGNED DEFAULT NULL`                | 软外键                                              |
| `client_ip varchar(64)`               | `client_ip VARCHAR(64) NOT NULL DEFAULT ''`               | PG 用 64,留 IPv6 余量                               |
| `status_code bigint`                  | `status_code INT UNSIGNED DEFAULT NULL`                   | HTTP status 实际是 smallint,INT 留余量              |
| `reason varchar(255)`                 | `reason VARCHAR(255) NOT NULL DEFAULT ''`                 | 失败原因                                            |
| `success boolean`                     | `success TINYINT(1) NOT NULL DEFAULT 0`                   | 业务级成功                                          |
| `location varchar(255)`               | `location VARCHAR(255) NOT NULL DEFAULT ''`               | IP 地理                                             |
| `user_agent text`                     | `user_agent TEXT NOT NULL DEFAULT ''`                     | UA 可能很长                                         |
| `browser_name varchar(128)`           | `browser_name VARCHAR(128) NOT NULL DEFAULT ''`           | UA 解析                                             |
| `browser_version varchar(128)`        | `browser_version VARCHAR(128) NOT NULL DEFAULT ''`        | UA 解析                                             |
| `client_id varchar(128)`              | `client_id VARCHAR(128) NOT NULL DEFAULT ''`              | 客户端 ID                                           |
| `client_name varchar(128)`            | `client_name VARCHAR(128) NOT NULL DEFAULT ''`            | 客户端名                                            |
| `os_name varchar(128)`                | `os_name VARCHAR(128) NOT NULL DEFAULT ''`                | UA 解析                                             |
| `os_version varchar(128)`             | `os_version VARCHAR(128) NOT NULL DEFAULT ''`             | UA 解析                                             |

### 2.2 `login_log` 字段映射

| PG `sys_login_log`                    | MySQL `login_log` v5                                      | 转换说明                           |
| ------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| `id bigint`                           | `id BIGINT UNSIGNED AUTO_INCREMENT`                       | 主流策略                           |
| `created_at timestamp with time zone` | `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | 同 api_log                         |
| `username varchar(64)`                | `username VARCHAR(64) NOT NULL DEFAULT ''`                | 加默认空串(允许匿名登录失败)       |
| `login_ip varchar(64)`                | `login_ip VARCHAR(64) NOT NULL DEFAULT ''`                | 重命名自 client_ip,与 api_log 区分 |
| `login_mac varchar(128)`              | `login_mac VARCHAR(128) NOT NULL DEFAULT ''`              | CS 场景下应用层填,B/S 场景空       |
| `login_time timestamp with time zone` | `login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | 登录尝试时刻                       |
| `user_agent text`                     | `user_agent TEXT NOT NULL DEFAULT ''`                     | 放宽                               |
| `browser_name varchar(128)`           | `browser_name VARCHAR(128) NOT NULL DEFAULT ''`           | UA 解析                            |
| `browser_version varchar(128)`        | `browser_version VARCHAR(128) NOT NULL DEFAULT ''`        | UA 解析                            |
| `client_id varchar(128)`              | `client_id VARCHAR(128) NOT NULL DEFAULT ''`              | 客户端 ID                          |
| `client_name varchar(128)`            | `client_name VARCHAR(128) NOT NULL DEFAULT ''`            | 客户端名                           |
| `os_name varchar(128)`                | `os_name VARCHAR(128) NOT NULL DEFAULT ''`                | UA 解析                            |
| `os_version varchar(128)`             | `os_version VARCHAR(128) NOT NULL DEFAULT ''`             | UA 解析                            |
| `sys_user_id bigint`                  | `sys_user_id BIGINT UNSIGNED DEFAULT NULL`                | 软外键                             |
| `status_code integer`                 | `status_code INT UNSIGNED DEFAULT NULL`                   | HTTP status                        |
| `success boolean`                     | `success TINYINT(1) NOT NULL DEFAULT 0`                   | 与 api_log 风格统一                |
| `reason varchar(255)`                 | `reason VARCHAR(255) NOT NULL DEFAULT ''`                 | 重命名自 failure_reason            |
| `location varchar(255)`               | `location VARCHAR(255) NOT NULL DEFAULT ''`               | IP 地理                            |

## 3. 索引策略

### 3.1 `api_log` 索引 (7 个)

| 索引                        | 覆盖查询                     | 备注                          |
| --------------------------- | ---------------------------- | ----------------------------- |
| `UNIQUE(request_id)`        | 跨表 JOIN operation_log      | 保留                          |
| `(sys_user_id, created_at)` | 按用户 + 时间                | v5 改名,user_id → sys_user_id |
| `(module, created_at)`      | 按模块 + 时间 (业务分析)     | v5 简化 (去掉 user 维度)      |
| `(path, created_at)`        | 按接口 + 时间 (热点接口分析) | v5 改名                       |
| `(status_code, created_at)` | 按状态码 + 时间 (错误率)     | v5 改名                       |
| `(success, created_at)`     | 业务级成功失败分布           | v5 新增                       |
| `(client_ip, created_at)`   | 客户端 IP 热点 / 风控        | v5 新增                       |

### 3.2 `login_log` 索引 (5 个)

| 索引                     | 覆盖查询                | 备注                          |
| ------------------------ | ----------------------- | ----------------------------- |
| `(username, created_at)` | 用户登录历史            | 保留                          |
| `(success, created_at)`  | 登录失败分析            | 保留                          |
| `(sys_user_id)`          | 用户维度查询            | v5 改名,user_id → sys_user_id |
| `(login_ip, created_at)` | 异地登录分析            | v5 新增 (重命名自 client_ip)  |
| `(login_time)`           | 时间窗口扫描 (TTL 作业) | v5 新增                       |

## 4. 兼容性 / 迁移风险

### 4.1 Schema 兼容性

- `schema.sql` v5 假定生产无数据(新部署);若有数据:
  - `sys_user` 移除 `dept_id` 会丢数据 → 需先 `ALTER TABLE sys_user ADD COLUMN dept_id_backup BIGINT UNSIGNED DEFAULT NULL` 再 `UPDATE ... SELECT ... FROM users_backup`
  - 4 张表移除 `description` 同理
  - `api_log` 大量字段重命名 / 新增 → 应用层 AOP 拦截器需同时改 ingestion 逻辑
  - `login_log` 同上
- 实际"v4 → v5"是 schema 设计层迭代,不是平滑迁移;若有数据,需单独立 migration 任务。

### 4.2 应用层影响 (Out of Scope)

- `apps/` 下若有 TypeScript entity / repository,需同步更新:
  - 字段名: `request_method` → `method` / `request_path` → `path` / 等等
  - 类型: `duration_ms: number` → `cost_time: bigint`
  - 索引: 索引名变化
  - 写入路径: 增加 UA 解析、IP 解析、客户端指纹注入
- 当前会话扫过 `apps/vue-vben-admin/` 是 untracked 状态,未发现 admin 后端代码(前端),所以本任务暂不影响 `apps/`。
- 未来 admin 后端 (Go / Java) 启动时需在新任务中处理 ingestion 逻辑。

## 5. 文档同步策略

- `docs/tables.md`:逐表字段表是权威速查,**必须**与 schema 完全一致;每处改动都加 v5+ 注释说明 delta。
- `docs/er.md`:ER 图 ASCII 部分不变(无字段细节);只在 §3 软引用清单反映 `dept_id` 移除和 `user_id → sys_user_id` 重命名。
- `docs/db-conventions.md`:约定文档,需同步:
  - §6.2 索引模式示例
  - §7.2 软外键清单
  - §9 JSON 字段约定
  - §11.1 日志表关键字段
  - §11.5 性能约束索引示例

## 6. 验证

- 语法层:`CREATE TABLE` 数量应为 22
- 结构层:用 `grep` 验证关键字段(已完成)
- 跨表一致性:用 `grep` 验证字段名/索引名在 4 个文件中一致
- 数据层(若有数据):不适用(本任务假定空表)
