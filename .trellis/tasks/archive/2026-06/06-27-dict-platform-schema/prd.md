# dict-platform-schema

## Goal

把 `backend/db/schema.sql` 中 `dict_type` 表的 `platform` 列移除，让 `dict_data` 表保持原状，schema 回归到「字典域无平台归属」的状态。

## Requirements

- `dict_type` 表移除 `platform VARCHAR(32) NOT NULL DEFAULT ''` 列。
- `dict_data` 表保持原状。
- `dict_type` 的 UNIQUE KEY `(code, deleted_at)` 不变。
- Section 7 / Section 10 注释同步记录 v7 变更。
- 不写数据库迁移脚本、不回填生产数据。

## Acceptance Criteria

- [x] `dict_type` 表不再包含 `platform` 列。
- [x] `dict_data` 表保持原状。
- [x] `dict_type` 的 UNIQUE KEY `(code, deleted_at)` 不变。
- [x] Section 7 / Section 10 注释同步记录 v7 变更。
