# dict-type platform mock

## Goal

`backend-mock-template` 的 `DictType` 数据模型、API、种子按 `platform=''` / `vue-admin` / `react-admin` 三份生成；dict-data 的 `list` / `by-type/:code` 支持按 platform 过滤；dict-data 的 POST/PUT 不接受 platform 字段。

## Requirements

- `DictType` 类型与 mock 种子按三份生成：`platform=''` 通用版、`platform='vue-admin'`、`platform='react-admin'`；同一 `code` 在三份之间互不冲突。
- dict-type `list` 接口支持 `platform` 精确筛选；传 `platform=react-admin` 时返回 `platform=''` 与 `platform='react-admin'` 的未删除类型。
- dict-type `all` 接口支持 `?platform=<code>`；传非空时返回该平台与通用项。
- dict-type POST/PUT 接受 `platform` 入参，未传时保存为空字符串；仅校验长度不超过 32；不允许 `code` 跨平台重复。
- dict-data `list` 接口支持 `platform` 过滤；传 `platform=react-admin` 时返回 `platform=''` 与 `platform='react-admin'` 类型下的未删除字典项。
- dict-data `by-type/:code?platform=<code>` 保留 platform 参数；传非空时返回该平台与通用类型下的启用字典项。
- dict-data POST/PUT 不接受也不存储 `platform` 字段（删除旧 schema 假设的逻辑）。
- 保持现有软删、分页、排序、状态筛选、批量操作行为不回退。

## Acceptance Criteria

- [ ] `apps/backend-mock-template/utils/mock-data.ts` 的 `DictType` 类型新增 `platform: string` 字段。
- [ ] `buildDictTypeSeeds()` 按 `platform=''` / `vue-admin` / `react-admin` 三份生成；同一 `code` 在三份之间互不冲突；现有 5 个 type 各自分三份。
- [ ] dict-type list/all/POST/PUT 支持 `platform`；POST/PUT 仅校验长度 ≤32；list 传 `platform=react-admin` 时返回通用+本平台未删项。
- [ ] dict-data list 支持 `platform` 过滤；传 `platform=react-admin` 时返回通用+本平台 type 下的未删项；`by-type/:code?platform=...` 保留 platform 参数。
- [ ] dict-data POST/PUT 拒绝并丢弃 `platform` 字段（mock 不持久化、不报错）。
- [ ] 现有 mock 测试或人工 smoke 通过；若仓库未提供 mock 单元测试，记录手工验证结果。

## Out of Scope

- 前端类型与 UI 改动（由 `dict-type-platform-react-admin` / `dict-type-platform-vue-vben-admin` 子任务处理）。
- 数据库迁移脚本、生产数据迁移。

## Review-gate Contract

- Review-gate contract: explicit-selection-v1
- Optional review gates status: configured
- Enabled optional review gates: (none)
- Disabled optional review gates: trellis-spec-review, trellis-code-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review