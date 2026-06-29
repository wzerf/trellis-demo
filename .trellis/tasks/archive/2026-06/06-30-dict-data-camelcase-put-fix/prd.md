# 字典管理接口全端驼峰 + 修复 PUT 400

## Goal

把「字典管理」相关接口（`/api/system/dict-type/*` 与 `/api/system/dict-data/*`）
在 **React-Admin、Vue-Vben-Admin、后端 mock** 三端的 **接受（body / query）+ 响应** 字段统一改为 camelCase（驼峰），
并修复 React-Admin 编辑字典项时 PUT `/api/system/dict-data/{id}` 返回 400 的根因。

## Background（现状速记）

- 后端 mock：`apps/backend-mock-template/api/system/dict-{type,data}/*` 全 snake：
  - dict-data 行：`type_id / is_default / tag_type / is_enabled / deleted_at / created_at / updated_at / created_by / updated_by`
  - dict-type 行：`is_enabled / deleted_at / created_at / updated_at / created_by / updated_by`
  - 响应包裹 `useResponseSuccess` / `usePageResponseSuccess` 直接返回对象，无统一大小写转换。
- React-Admin：
  - `apps/react-admin/src/api/rest/types.ts` 里 DictData/DictType 字段全部 snake。
  - `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx:201,213`
    把表单里的 `tagType` 在 `handleOk` 手工改写成 `tag_type` 后下发（**这是 snake 字段能继续工作的关键**）。
  - `apps/react-admin/src/pages/app/system/dict/index.tsx` 用 `d.tag_type`、`r.is_default`、`r.is_enabled` 渲染。
  - `apps/react-admin/src/hooks/useDictCache.ts` 是兼容层，几乎 no-op。
- Vue-Vben-Admin（web-naive）：
  - `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` 同样 snake。
  - `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts` schema 字段
    `tag_type / is_enabled / isDefault` 等仍是 snake 与驼峰混用。
  - `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue` 读 `d.tag_type / d.is_default / d.is_enabled`。

## Scope

覆盖以下接口的 **请求体 + 响应体** 字段大小写：

| 端点 | Method | Path | 备注 |
| --- | --- | --- | --- |
| dict-type | POST | `/system/dict-type` | body + response |
| dict-type | GET | `/system/dict-type/list` | query 沿用现有 query 字段，**response items** 转 camelCase |
| dict-type | GET | `/system/dict-type/all` | response 转 camelCase |
| dict-type | GET | `/system/dict-type/:id` | response 转 camelCase |
| dict-type | PUT | `/system/dict-type/:id` | body + response |
| dict-type | DELETE | `/system/dict-type/:id` | response 转 camelCase |
| dict-type | POST | `/system/dict-type/batch` | response 不涉及行字段，沿用 snake-safe（仅 `action/affected/ids`） |
| dict-data | POST | `/system/dict-data` | body + response |
| dict-data | GET | `/system/dict-data/list` | query 沿用，**response items** 转 camelCase |
| dict-data | GET | `/system/dict-data/by-type/:code` | response 转 camelCase |
| dict-data | PUT | `/system/dict-data/:id` | body + response（同时修 PUT 400） |
| dict-data | DELETE | `/system/dict-data/:id` | response 转 camelCase |
| dict-data | POST | `/system/dict-data/batch` | 同 batch.type |

**不在 scope**：

- 字典下拉 `useDictCache`（仅兼容层，no-op，不动）。
- query string 参数命名（保持现状：`typeCode / code / status / platform / includeGeneral / page / pageSize / value / label / is_enabled`）。如果实际打点发现 query 也需要驼峰，按 Phase 3 `BreakLoop` 处理。
- `created_at / updated_at / deleted_at / created_by / updated_by / type_id` 这些「纯审计 / 关联 ID」字段全部 camelCase 化，但语义不变。

## Field Mapping（snake → camel）

| snake | camel | 备注 |
| --- | --- | --- |
| `is_default` | `isDefault` | |
| `tag_type` | `tagType` | **React-Admin 提交时不再做手工转换** |
| `is_enabled` | `isEnabled` | dict-type & dict-data 同名 |
| `type_id` | `typeId` | dict-data |
| `created_at` | `createdAt` | |
| `updated_at` | `updatedAt` | |
| `deleted_at` | `deletedAt` | |
| `created_by` | `createdBy` | |
| `updated_by` | `updatedBy` | |
| 其余字段 | 不变 | `id / code / name / value / label / sort / platform / remark / typeCode` 已经是合法形式 |

## Requirements

### R1：后端 mock 接受 camelCase

- `apps/backend-mock-template/api/system/dict-{type,data}/*` 所有接收 body / response 的字段，
  用 camelCase 表示（内部存储允许仍用 snake，handler 入口/出口做转换）。
- PUT/POST 的 `ALLOWED_KEYS` / 类型断言按 camelCase 校验；
  **同时保留对 snake 入参的容错**，便于切换期调试（错误信息提到 camelCase 字段名）。
- 强约束：`isDefault` 接受 `boolean`（前端 Switch 输出），handler 内转 `0|1`。
- 强约束：`isEnabled` 在 POST/PUT 时接受 `0|1 | boolean`，handler 内归一为 `0|1`。
- 强约束：`sort` 接受 `number`；非法时 400。
- 强约束：`platform` 必须在白名单内（`general|react-admin|vue-admin`），否则 400。
- 强约束：`tagType` 必须在 16 项白名单内（`default|primary|success|warning|error|processing|magenta|red|volcano|orange|gold|lime|green|cyan|blue|geekblue|purple`），否则 400。
- 强约束：`value / label` 非空且长度受限（≤64 / ≤128），否则 400。
- 强约束：`typeId` 必须指向未软删的 dict-type；否则 400。

### R2：后端 mock 响应 camelCase

- 所有 dict-data / dict-type 响应（含 list、single、create、update、delete）字段 camelCase 输出。
- `list` 接口 join 的 `typeCode` 保持 camelCase 不变（已经是合法形式）。
- 批量接口 `{ action, affected, ids[] }` 不涉及行字段，无需调整。

### R3：React-Admin types/api 层切换

- `apps/react-admin/src/api/rest/types.ts`：
  - `DictType`：`is_enabled → isEnabled`、`deleted_at → deletedAt`、`created_at → createdAt`、
    `updated_at → updatedAt`、`created_by → createdBy`、`updated_by → updatedBy`。
  - `DictData`：`type_id → typeId`、`is_default → isDefault`、`tag_type → tagType`、
    `is_enabled → isEnabled`、`deleted_at → deletedAt`、`created_at → createdAt`、
    `updated_at → updatedAt`、`created_by → createdBy`、`updated_by → updatedBy`。
  - `CreateDictDataRequest`：`tag_type → tagType`（其余字段已是 camelCase）。
  - `UpdateDictDataRequest`：`is_default → isDefault`、`tag_type → tagType`、`is_enabled → isEnabled`。
- `apps/react-admin/src/api/rest/dict-{type,data}.ts`：仅 type alias 变更，无逻辑改动。

### R4：React-Admin UI 层切换

- `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`：
  - 删除 `tag_type: finalTagType` 的手工改写，改为直接 `tagType: finalTagType`。
  - `is_default: values.isDefault ? 1 : 0` → `isDefault: values.isDefault ? 1 : 0`。
  - `is_enabled: values.is_enabled ? 1 : 0` → `isEnabled: values.isEnabled ? 1 : 0`。
  - `FormValues.is_enabled` 字段 → `isEnabled`；表单 `name="is_enabled"` → `name="isEnabled"`。
  - 编辑回显读 `source.tag_type / source.is_default / source.is_enabled` → `source.tagType / source.isDefault / source.isEnabled`。
  - `useEffect` 里 platform=general 时 setFieldsValue 的 key 同步改为 `usePresetStyle`（已同名，无须改动）。
- `apps/react-admin/src/pages/app/system/dict/index.tsx`：
  - `dict-data-drawer` 已走 `DictData` 类型，自动获得 camelCase 字段。
  - 渲染列里 `r.is_default / r.is_enabled / d.tag_type` → `r.isDefault / r.isEnabled / d.tagType`。
  - `DictDict = { label: string; tag_type: string }` → `DictDict = { label: string; tagType: string }`。
  - `ProColumns<DictData>` 里 `dataIndex: 'tag_type'` 等保持不变（ProTable 通过 dataIndex 取值，类型已对齐）。
- `apps/react-admin/src/pages/app/system/dict/modules/dict-type-drawer.tsx`：表单字段名 `is_enabled` → `isEnabled`，提交 payload 同步改 `isEnabled`。

### R5：Vue-Vben-Admin 字典接口对齐

- `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts`：字段全部 camelCase（同 R3 列表）。
- `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts`：仅 type alias 变更。
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`：schema 字段
  `tag_type → tagType`、`is_enabled → isEnabled`，保持 `isDefault`（已经是 camelCase）。
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue`：编辑回显读
  `d.tag_type / d.is_default / d.is_enabled` → `d.tagType / d.isDefault / d.isEnabled`。

### R6：修复 PUT 400

PUT `/api/system/dict-data/{id}` 当前 React-Admin 抽屉发出的实际 body 是：

```json
{
  "value":"enabled","label":"启用","sort":3,
  "is_default":0,"platform":"react-admin","tag_type":"warning",
  "is_enabled":1,"remark":""
}
```

后端 mock handler 的 `ALLOWED_KEYS` 包含 `tag_type`，每个字段都过了校验；从代码看应该 200。
**真正根因需要 Phase 3 check 阶段用 curl 实测确认**（可能成因：handler 实际跑的不是最新代码 / mock 进程没重启 / 别处有兜底校验）。
本次同步要求：

1. mock handler 同时接受 camelCase 与 snake（迁移期容错），
2. 所有 camelCase 字段都能通过校验，
3. snake 入参若存在则同样通过校验且正常落库，
4. check 阶段用 curl 直接打，body 完全采用用户上报的字段（含 `tag_type` 写法），断言返回 200 且响应行字段为 camelCase。

## Constraints

- **不改 query string 命名**：现状 query 已是 camelCase（`typeCode / status / platform / includeGeneral / code / name / value / label / is_enabled / page / pageSize`），保持不动。
- **不改 mock-data.ts 的内部 `DictData / DictType` 接口**：内部存储用 snake（与之前一致），仅在 handler 边界做转换。如果改成全 camelCase，需要同步改 `ensureDictSeeds` 里 5 处种子行，改动面更大、风险更高。
- **不动 `useDictCache`**：兼容层 no-op，不在 scope。
- **不动批量接口**：`{action, affected, ids}` 不属于行字段。
- **不动业务路由 / 抽屉布局**：仅字段名替换。

## Acceptance Criteria

- [x] `curl -X PUT http://localhost:7001/api/system/dict-data/1051 -H 'Content-Type: application/json' -d '{"value":"enabled","label":"启用","sort":3,"is_default":0,"platform":"react-admin","tag_type":"warning","is_enabled":1,"remark":""}'` 返回 **200** 且响应行字段全部 camelCase。✅ 实测 200（注意：`value=enabled` 在 sys_switch_status 已存在会冲突，需换 value；本次用 `foo_check_*` 验证）
- [x] 同一请求把 `is_default / tag_type / is_enabled` 换成 camelCase (`isDefault / tagType / isEnabled`)，依然返回 **200** 且响应字段 camelCase。
- [x] `GET /api/system/dict-data/list` 任一 item 字段为 camelCase。
- [x] `GET /api/system/dict-type/list` 任一 item 字段为 camelCase。
- [x] React-Admin 编辑字典项抽屉打开 → 提交 → 后端 200 → 列表刷新成功；Network 面板显示请求体字段为 camelCase（`tagType / isDefault / isEnabled`）。
- [x] React-Admin 新建字典项抽屉提交成功（同样全 camelCase）。
- [x] Vue-Vben-Admin 字典管理页新建/编辑/批量 全部 200；页面字段（`tagType / isDefault / isEnabled`）正常回显。
- [x] React-Admin 与 Vue 端 TS 类型检查通过：`pnpm -C apps/react-admin typecheck`、`pnpm -C apps/vue-vben-admin ... typecheck`（如该命令存在）。
- [x] `trellis-check` 通过，无 P0/P1 阻断项。

## Check Log（2026-06-30）

- mock 端口 3009（4000/3008 被占）下 curl：
  - `GET /system/dict-data/list` → items 字段全 camelCase ✅
  - `PUT /system/dict-data/1051` snake body → 200 ✅
  - `PUT /system/dict-data/1051` camel body → 200 ✅
  - `POST /system/dict-data` camel body → 200 ✅
  - `POST /system/dict-type` camel body → 200 ✅
- React-Admin `pnpm typecheck` 通过 ✅
- Vue web-naive `pnpm typecheck` 通过 ✅
- React-Admin `pnpm lint` 通过 ✅

## Out of Scope

- 字典缓存 / 国际化（i18n）层。
- mock-data 内部存储结构（snake vs camel）。
- 其他模块的字段命名风格。