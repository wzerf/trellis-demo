# 清理 dict_type / dict_data platform 字段

## Goal

把之前 4 个 `dict-type-platform-*` 子任务接入的 `dict_type.platform` / `dict_data` 平台归属，从数据库 schema、`backend-mock-template` 与两个前端管理端（`react-admin`、`vue-vben-admin`）一并移除，让字典域回归到无平台归属的纯字典模型；保留现有 CRUD / 批量 / 软删 / 分页 / 排序 / 状态筛选行为不回退。

## User Value

字典类型和字典项不再绑定前端管理端平台，跨端复用字典数据时不再有「按平台隔离」的隐式约束；schema、mock、类型、UI 与 i18n 完全一致地清理一遍，避免半残状态造成误导。

## Confirmed Facts

- `backend/db/schema.sql` 中 `dict_type` 表新增了 `platform VARCHAR(32) NOT NULL DEFAULT '' COMMENT '平台标识(...)'`。
- `backend-mock-template/utils/mock-data.ts` 中 `DictType` 类型新增 `platform: string`；`PLATFORMS` 常量与 `buildDictTypeSeeds()` 把 5 个 type 按三份生成。
- mock API：`dict-type/list`、`dict-type/all`、`dict-type/[id].put`、`dict-type/index.post`、`dict-data/list`、`dict-data/by-type/[code]` 都接入了 platform 入参与过滤；`dict-data` POST/PUT 已显式不接收 platform。
- `apps/react-admin/src/api/rest/types.ts`：`DictType` / `DictTypeQuery` / `CreateDictTypeRequest` / `UpdateDictTypeRequest` / `DictDataQuery` 都加了 `platform?: string`。
- `apps/react-admin`：`shared.ts`、`dict-type-drawer.tsx`、`index.tsx`、两个 `dict-type.json` i18n、`.env.development` / `.env.production` 都接入了 platform。
- `apps/vue-vben-admin/apps/web-naive`：`api/system/dict/types.ts`、`api/system/dict/index.ts`、`views/system/dict/data.ts`、`index.vue`、两个 `system.json` i18n、两个 `.env.*` 都接入了 platform。
- 仓库中存在 `node_modules/`、`dist/`、`apps/backend-mock-template/.nitro/dev/` 等含 `platform` 字样的编译/缓存产物，本次不在源码层清理范围内。
- 路由模块里的 `sys:platform_admin` 注释、vue-vben-admin `@core/preferences` 的 `dataset.platform`、`process.platform`、`os.platform()` 等与字典域无关，不在本任务范围内。

## Subtasks

实施策略：mock 与 schema 先固化（避免前端在缺字段/字段不一致时飘移），react-admin 与 vue-vben-admin 并行推进。父任务负责源需求集合、任务地图与跨子任务验收；本身不直接实现。

- `dict-platform-schema`：`backend/db/schema.sql` 移除 `dict_type.platform` 列；`dict_data` 表保持原样。
- `dict-platform-mock`：`backend-mock-template` 的 `DictType` 模型、种子、API、跨表过滤全部移除 platform；`dict-data` POST/PUT 不再需要任何 platform 兜底注释。
- `dict-platform-react-admin`：`react-admin` 类型、列表、表单、筛选、`.env`、i18n 全部回滚。
- `dict-platform-vue-vben-admin`：`vue-vben-admin` 类型、列表、表单、筛选、`.env`、i18n 全部回滚。

每个子任务可独立 planning / implement / check / archive；本任务负责源需求集合、任务地图与跨子任务验收标准。

## Requirements

### schema

- `backend/db/schema.sql` 中 `dict_type` 表移除 `platform` 列；`dict_type` 唯一键保持不变；`dict_data` 表保持原样。

### mock

- `apps/backend-mock-template/utils/mock-data.ts` 中 `DictType` 类型移除 `platform: string`；移除 `PLATFORMS` 常量；`buildDictTypeSeeds()` 改为单份生成（5 个 type 不再翻三份）。
- `apps/backend-mock-template/api/system/dict-type/list.ts`：移除 query 入参 `platform` 与对应过滤分支。
- `apps/backend-mock-template/api/system/dict-type/all.ts`：移除 `?platform=<code>` 入参与过滤。
- `apps/backend-mock-template/api/system/dict-type/[id].put.ts`：`ALLOWED_KEYS` 移除 `platform`；移除 platform 校验、code+platform 联合唯一性校验与平台相关报错文案。
- `apps/backend-mock-template/api/system/dict-type/index.post.ts`：移除 `platform` 入参与校验，恢复 code 单独唯一。
- `apps/backend-mock-template/api/system/dict-data/list.ts`：移除 `platform` 入参与「按所属 type 的 platform 决定」的过滤。
- `apps/backend-mock-template/api/system/dict-data/by-type/[code].ts`：移除 `?platform=<code>` 入参与过滤。
- 现有软删、分页、排序、状态筛选、批量操作行为不回退。

### react-admin

- `apps/react-admin/src/api/rest/types.ts`：`DictType` / `DictTypeQuery` / `CreateDictTypeRequest` / `UpdateDictTypeRequest` / `DictDataQuery` 移除 `platform` 字段与相关 JSDoc。
- `apps/react-admin/src/api/rest/dict-type.ts`：移除参数透传里的 `platform`。
- `apps/react-admin/src/pages/app/system/dict/modules/shared.ts`：移除 `getDefaultPlatform()` / platform 选项 / platformPlaceholder / platform 提示文本；`import.meta.env.VITE_APP_PLATFORM` 默认值读取同步移除。
- `apps/react-admin/src/pages/app/system/dict/modules/dict-type-drawer.tsx`：移除表单 platform 字段、Form.Item、submit payload 里的 platform。
- `apps/react-admin/src/pages/app/system/dict/index.tsx`：移除 dict-type / dict-data 列表 platform 列、平台筛选、右表 platform 联动与点行锁定 platform 的所有逻辑。
- `apps/react-admin/src/locales/{zh-CN,en-US}/_modules/dict-type.json`：移除 `platform` / `platformPlaceholder` / `platformTooltip` / `platformGeneral` / `platformVueAdmin` / `platformReactAdmin` 键。
- `apps/react-admin/.env.development` / `.env.production`：移除 `VITE_APP_PLATFORM=react-admin`。
- 现有 CRUD、批量、软删、多选、点行同步 typeCode 行为不回退。

### vue-vben-admin

- `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts`：移除 `DictType` / `DictTypeQuery` / `CreateDictTypeRequest` / `UpdateDictTypeRequest` / `DictDataQuery` 中的 `platform` 字段与 JSDoc。
- `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/index.ts`：移除入参 `platform`。
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`：移除 platform 字段、平台选项、`getDefaultPlatform()`、`import.meta.env.VITE_APP_PLATFORM` 读取、列上的 platform 渲染。
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`：移除左表 platform 列、右表 platform 联动、点行锁定 platform 的逻辑。
- `apps/vue-vben-admin/apps/web-naive/src/locales/langs/{zh-CN,en-US}/system.json`：移除 dict 模块下的 `platform` / `platformPlaceholder` / `platformGeneral` / `platformTooltip` 键。
- `apps/vue-vben-admin/apps/web-naive/.env.development` / `.env.production`：移除 `VITE_APP_PLATFORM=vue-admin`。
- 现有 CRUD、批量、软删、多选、点行同步 typeCode 行为不回退。

## Acceptance Criteria

- [ ] `backend/db/schema.sql` 中 `dict_type` 表不再包含 `platform` 列；`dict_data` 表保持原样。
- [ ] `apps/backend-mock-template/utils/mock-data.ts` 中 `DictType` 不再包含 `platform`；种子只生成单份（5 个 type）。
- [ ] mock API：`dict-type/list` / `dict-type/all` / `dict-type/[id].put` / `dict-type/index.post` / `dict-data/list` / `dict-data/by-type/[code]` 都不再出现 platform 相关代码与文案；`dict-type` POST/PUT 仅校验 code 唯一。
- [ ] `apps/react-admin` 的类型、API、列表、表单、`.env`、i18n 中 platform 痕迹全部清理；`VITE_APP_PLATFORM` 不再出现在 `.env.*`。
- [ ] `apps/vue-vben-admin` 的类型、API、列表、表单、`.env`、i18n 中 platform 痕迹全部清理；`VITE_APP_PLATFORM` 不再出现在 `.env.*`。
- [ ] 三侧源代码（不含 node_modules / dist / .nitro 缓存）中不再出现与字典域相关的 `platform` 字段引用。
- [ ] 现有 mock、CRUD、批量、软删、分页、排序、状态筛选、点行联动 typeCode 行为不回退。
- [ ] 相关前端的类型检查或 lint 命令通过（若仓库已有已知失败需记录实际输出）。

## Out of Scope

- 路由模块里 `sys:platform_admin` 的注释、`@core/preferences` 中 `dataset.platform`、构建脚本里的 `process.platform` 等与字典域无关的 `platform` 出现。
- `node_modules/`、`dist/`、`apps/backend-mock-template/.nitro/dev/` 等构建/缓存产物。
- 平台枚举中心化、平台字典类型、新增平台。
- 真实后端数据库迁移脚本、生产数据迁移。
- 权限、菜单、路由结构调整。

## Open Questions Blocking Planning

None after repository inspection and user decisions：dict_type / dict_data 的 platform 全清；dict_data 对 dict_type.platform 的引用一并清理；`backend/db/schema.sql` 同步修改。

## Review-gate Contract

- Review-gate contract: explicit-selection-v1
- Optional review gates status: configured
- Enabled optional review gates: (none)
- Disabled optional review gates: trellis-spec-review, trellis-code-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review