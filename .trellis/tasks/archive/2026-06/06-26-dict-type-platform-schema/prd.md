# dict-type platform schema

## Goal

`backend/db/schema.sql` 的 `dict_type` 表新增 `platform` 字段，使后续 mock 与前端可按平台区分字典类型。

## Requirements

- `dict_type` 表新增列：`platform VARCHAR(32) NOT NULL DEFAULT '' COMMENT '平台标识(如 vue-admin/react-admin;空=通用)'`。
- `dict_type` 的现有 UNIQUE KEY 保持不变（与 platform 不相关）。
- `dict_data` 表保持原样，不增加 `platform` 字段（之前的 schema 增量需回退）。
- 仅改 schema.sql 文件，不涉及后端代码或脚本。

## Acceptance Criteria

- [ ] `backend/db/schema.sql` 中 `dict_type` 表新增 `platform VARCHAR(32) NOT NULL DEFAULT '' COMMENT '平台标识(如 vue-admin/react-admin;空=通用)'`。
- [ ] `dict_data` 表不包含 `platform` 字段；唯一键仍为 `(type_id, value, deleted_at)`。
- [ ] schema.sql 中 `dict_type` 的列顺序将 `platform` 放在 `code` 之后、`name` 之前，便于阅读。

## Out of Scope

- 数据库迁移脚本、生产数据迁移。
- 后端 mock 业务逻辑、前端类型与 UI 改动（由对应子任务处理）。

## Review-gate Contract

- Review-gate contract: explicit-selection-v1
- Optional review gates status: configured
- Enabled optional review gates: (none)
- Disabled optional review gates: trellis-spec-review, trellis-code-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review