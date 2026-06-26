# dict-type platform react-admin

## Goal

`react-admin` 管理端同步 `dict_type.platform` 字段：类型定义、列表展示、筛选、表单编辑、`.env` 环境变量、中英文 i18n 同步。

## Requirements

- `apps/react-admin/src/api/rest/types.ts` 中 `DictType` / `DictTypeQuery` / `CreateDictTypeRequest` / `UpdateDictTypeRequest` 同步 platform 字段。
- 列表新增 `platform` 列：默认展示，支持下拉搜索筛选；默认从 `import.meta.env.VITE_APP_PLATFORM` 读取并预填。
- 字典项列表也支持 platform 筛选（直接走 mock 端 list 的 platform 过滤）。
- 字典类型表单新增 platform 字段：下拉搜索框，选项 `''`（通用）、`vue-admin`、`react-admin`。
- `.env.development` / `.env.production` 同步加入 `VITE_APP_PLATFORM=react-admin`。
- 中英文 i18n 同步 platform 文案。
- 保持现有 CRUD、批量、软删等行为不回退。

## Acceptance Criteria

- [ ] `apps/react-admin/src/api/rest/types.ts` 中 `DictType` / `DictTypeQuery` / `CreateDictTypeRequest` / `UpdateDictTypeRequest` 新增 `platform` 字段。
- [ ] dict-type 列表新增 platform 列；筛选区提供 platform 下拉搜索；默认按 `import.meta.env.VITE_APP_PLATFORM` 预填。
- [ ] dict-data 列表筛选区也提供 platform 下拉搜索；默认按 `import.meta.env.VITE_APP_PLATFORM` 预填。
- [ ] dict-type 抽屉表单新增 platform 字段，使用下拉搜索框，选项 `''` / `vue-admin` / `react-admin`；新建/编辑可保存并回显。
- [ ] `apps/react-admin/.env.development` / `apps/react-admin/.env.production` 加入 `VITE_APP_PLATFORM=react-admin`。
- [ ] `apps/react-admin/src/locales/zh-CN/_modules/dict-type.json` / `apps/react-admin/src/locales/en-US/_modules/dict-type.json` 加入 platform 字段名/筛选 label/选项 label。
- [ ] react-admin 类型检查或 lint 通过。

## Out of Scope

- 真实后端数据库迁移。
- 字典项表单增加 platform 字段（mock 端 POST/PUT 不接受 platform，前端无需展示/编辑）。
- 平台枚举中心化。

## Review-gate Contract

- Review-gate contract: explicit-selection-v1
- Optional review gates status: configured
- Enabled optional review gates: (none)
- Disabled optional review gates: trellis-spec-review, trellis-code-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review