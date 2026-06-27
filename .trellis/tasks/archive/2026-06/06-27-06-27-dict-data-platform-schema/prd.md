# 子任务 1 — schema 升级（v8）

## 范围

修改 `backend/db/schema.sql`：
- `dict_data` 表加列 `platform VARCHAR(32) NOT NULL DEFAULT 'general'`（位置在 `is_default` 与 `is_enabled` 之间，保持「业务字段在前、状态字段在后」的现有节奏）。
- 加索引 `INDEX idx_dict_data_platform (platform)`。
- Section 10 块注释加 `v8: 重新加 platform(字典项归属平台)`。
- 顶部版本号说明加 v8 段。
- `dict_type` 不动（保持 v7）。

## 验收

- [ ] `dict_data` 表含 platform 列，约束 `NOT NULL DEFAULT 'general'`
- [ ] `idx_dict_data_platform (platform)` 存在
- [ ] Section 10 块头注释出现 `v8` 标记
- [ ] 顶部版本号说明里出现 v8 段
- [ ] `dict_type` 表与索引不变

## 不动

- 其它 21 张表
- casbin_rule / 4 张关联表 / 日志类