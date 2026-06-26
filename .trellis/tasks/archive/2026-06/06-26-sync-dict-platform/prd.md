# 同步字典平台标识

## Goal

将 `dict_type.platform` 平台标识从数据库 schema 同步到 mock 后端与两个前端管理端（react-admin、vue-vben-admin），区分 `vue-admin` / `react-admin` 两个平台；前端管理端默认仅展示本平台的字典类型及其下字典项，保留通用（`platform=''`）字典的兜底能力。

## User Value

字典类型可以携带平台归属，不同管理端默认只看本平台的字典类型；跨平台查看时可手动切换 platform 筛选；mock 后端支持平台隔离的种子数据，便于后续按平台维护字典。

## Confirmed Facts

- `backend/db/schema.sql` 的 `dict_data` 表保持原样（不增加 `platform`），唯一键仍为 `(type_id, value, deleted_at)`。
- `backend/db/schema.sql` 的 `dict_type` 表新增 `platform VARCHAR(32) NOT NULL DEFAULT ''`。
- `backend-mock-template` 的字典类型 mock 数据模型位于 `apps/backend-mock-template/utils/mock-data.ts`，当前 `DictType` 尚未包含 `platform`。
- `backend-mock-template` 的 dict-type API（list / all / detail / put / post / batch / delete）：均无 `platform` 入参/返回。
- `backend-mock-template` 的 dict-data API（list / by-type / post / put / batch / delete）：均无 `platform` 入参/返回。
- `react-admin` 的字典类型定义位于 `apps/react-admin/src/api/rest/types.ts`。
- `vue-vben-admin` 的字典类型定义位于 `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts`。
- 仓库中**没有** `VITE_APP_PLATFORM` 环境变量。
- 既有 i18n：`apps/react-admin/src/locales/{zh-CN,en-US}/_modules/dict-entry.json`、`apps/vue-vben-admin/apps/web-naive/src/locales/{zh-CN,en-US}/dict-entry.json` 与对应 `dict-type.json`。

## Subtasks

实施策略：当前会话 + master；并行推进各子任务，但 mock API 改动需先固化。Schema 任务先完成，mock、react-admin、vue-vben-admin 三个子任务随后并行或先后推进均可。

- `dict-type-platform-schema`：schema.sql 同步 dict_type platform 字段；唯一键不变。
- `dict-type-platform-mock`：backend-mock-template DictType 模型、API、种子按三份生成；dict-data list/by-type 支持 platform 过滤；POST/PUT 不接受 platform。
- `dict-type-platform-react-admin`：react-admin DictType/DictData 类型、列表/表单/筛选、env、i18n。
- `dict-type-platform-vue-vben-admin`：vue-vben-admin DictType/DictData 类型、列表/表单/筛选、env、i18n。

每个子任务可独立 planning / implement / check / archive；本任务负责源需求集合、任务地图与跨子任务验收标准。

## Requirements

- `backend/db/schema.sql` 的 `dict_type` 表新增 `platform VARCHAR(32) NOT NULL DEFAULT '' COMMENT '平台标识(如 vue-admin/react-admin;空=通用)'`。
- `backend-mock-template` 的 `DictType` 数据模型、种子数据、创建、更新、列表、详情、批量、全量接口应包含 `platform` 字段。
- mock 后端 dict-type `list` 接口支持 `platform` 精确筛选；传 `platform=react-admin` 时返回 `platform=''` 与 `platform='react-admin'` 的未删除类型。
- mock 后端 dict-type `all` 接口支持 `?platform=<code>`；传非空时返回该平台与通用项。
- mock 后端 dict-data `list` 接口支持 `platform` 精确筛选；传 `platform=react-admin` 时返回该平台类型下以及通用类型下所有未删除字典项。
- mock 后端 dict-data `by-type/:code?platform=<code>` 保留 platform 参数；传非空时返回该平台与通用类型下的启用字典项。
- mock 后端 dict-data 的 POST/PUT 不接受也不存储 `platform` 字段。
- 字典类型按平台拆三份：`platform=''` 通用版、`platform='vue-admin'`、`platform='react-admin'`；同一 `code` 在三份之间互不冲突。
- mock 后端 platform 仅校验长度不超过 32，不强制 enum；允许编辑 platform 字段。
- `react-admin` 的 dict-type / dict-data 类型、列表、表单、筛选需要与新字段同步；`.env.development` / `.env.production` 加入 `VITE_APP_PLATFORM=react-admin`；前端 platform 字段使用下拉搜索框，选项 `''` / `vue-admin` / `react-admin`；列表默认筛选 `platform=react-admin`。
- `vue-vben-admin` 的 dict-type / dict-data 类型、列表、表单、筛选需要与新字段同步；`.env.development` / `.env.production` 加入 `VITE_APP_PLATFORM=vue-admin`；前端 platform 字段使用下拉搜索框，选项 `''` / `vue-admin` / `react-admin`；列表默认筛选 `platform=vue-admin`。
- 同步中英文 i18n 文案。
- 保持现有软删、分页、排序、状态筛选、批量操作行为不回退。

## Acceptance Criteria

- [ ] `backend/db/schema.sql` 的 `dict_type` 表新增 `platform` 字段；`dict_data` 表保持原样。
- [ ] `backend-mock-template` 的 `DictType` 与种子按 `platform=''` / `vue-admin` / `react-admin` 三份生成；同一 `code` 在三份之间互不冲突。
- [ ] mock 后端 dict-type POST/PUT 接受 `platform` 入参，未传时保存为空字符串；仅校验长度不超过 32；list 支持 platform 过滤。
- [ ] mock 后端 dict-data list 支持 platform 过滤；by-type 保留 platform 参数；POST/PUT 不接受 platform。
- [ ] `react-admin` 的 `DictType` 类型、列表/表单/筛选与后端字段一致，列表默认展示 platform 列并默认筛选 `platform=react-admin`（来自 `import.meta.env.VITE_APP_PLATFORM`），提供 platform 下拉搜索框作为筛选条件，编辑 platform 使用下拉搜索框，选项 `''` / `vue-admin` / `react-admin`；`.env.development` / `.env.production` 加入 `VITE_APP_PLATFORM=react-admin`。
- [ ] `vue-vben-admin` 的 `DictType` 类型、列表/表单/筛选与后端字段一致，列表默认展示 platform 列并默认筛选 `platform=vue-admin`（来自 `import.meta.env.VITE_APP_PLATFORM`），提供 platform 下拉搜索框作为筛选条件，编辑 platform 使用下拉搜索框，选项 `''` / `vue-admin` / `react-admin`；`.env.development` / `.env.production` 加入 `VITE_APP_PLATFORM=vue-admin`。
- [ ] 同步 `apps/react-admin/src/locales/zh-CN/_modules/dict-type.json` / `apps/react-admin/src/locales/en-US/_modules/dict-type.json` 与 vue-vben-admin 同名文件中 platform 相关文案（中英文同步）。
- [ ] 相关前端类型检查或 lint 命令通过，若仓库已有已知失败需记录实际输出。

## Likely Out of Scope

- 真实后端数据库迁移脚本或生产数据迁移。
- `dict_data` 重新引入 platform 字段。
- 平台枚举中心化管理或新增平台字典类型（除非用户要求）。
- 权限、菜单、路由结构调整。

## Open Questions Blocking Planning

None after repository inspection and user decisions: `platform` 上提到 `dict_type`；类型归属平台；保持原默认筛选语义；by-type 保留 platform 参数；拆 4 个子任务；当前会话 + master；五个可选 review gate 全部 disabled。

## Review-gate Contract

- Review-gate contract: explicit-selection-v1
- Optional review gates status: configured
- Enabled optional review gates: (none)
- Disabled optional review gates: trellis-spec-review, trellis-code-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review