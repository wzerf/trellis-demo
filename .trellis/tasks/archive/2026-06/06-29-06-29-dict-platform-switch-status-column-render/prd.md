# 三端字典管理页面:状态 / 归属平台列改用字典 label + tag_type 渲染

## Goal

在 06-28 任务已落地 sys_switch_status 字典种子 + useListDictData hook 的基础上, 把三端字典管理页面「状态」「归属平台」两列从静态 valueEnum / 写死 formatter 改成从字典 API 拉到的 label 与 tag_type 来渲染。 让「开关状态」「归属平台」这两个字段真正成为「字典驱动」的展示, 而不是「字典只用于数据落库 + 列表写死」的现状。 **调用方必须显式带 `includeGeneral=true`** 才能在 `platform` 非 general 时拿到 general 组 (mock `list.ts` 默认 `includeGeneral=false`, 接口语义不变)。

## Background (已确认事实)

- `apps/backend-mock-template/utils/mock-data.ts` 已经种入 `sys_switch_status` 字典(type_id=5), 含 6 条字典项 (general/react-admin/vue-admin × enabled/disabled), 每条都带 `label`、`tag_type`(`general` 组为空字符串、`react-admin`/`vue-admin` 组为 `success`/`error`)。
- `apps/backend-mock-template/api/system/dict-data/list.ts` 返回的 `DictData` 携带 `label`、`tag_type`、`platform` 等字段, 客户端无需 enrichment 即可直接消费。
- **问题**: `sys_platform` 字典**没有种子**。 平台枚举 `"general" / "react-admin" / "vue-admin"` 当前是通过 `ALLOWED_DICT_DATA_PLATFORMS` 字面量 + 前端 `SEARCH_PLATFORM_OPTIONS` 静态列表硬编码呈现的, 没有「平台」这个字典类型供查询。
- 两端的 `useListDictData` hook 已存在但**字典管理页面没在用**, 仍然调用 raw `listDictDataApi` / `fetchDictDataListApi`:
  - react-admin: `apps/react-admin/src/api/hooks/dict.ts:119-140` 定义了 `useListDictData`, 但 `apps/react-admin/src/pages/app/system/dict/index.tsx` 走的是 raw `listDictDataApi`(`@/api/rest/dict-data`)。
  - vue-vben: `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts:139-156` 定义了 `useListDictData`, 但 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts` 仍是纯函数 + 静态 enum。
- `apps/backend-mock-template/api/system/dict-data/list.ts` 已经支持 `?typeCode[]=` 数组参数(`list.ts:29-41`), 可以在**一次 list 调用**里拉多个 typeCode 的字典; 返回的 `DictData` 项里已 join 了 `typeCode` 字段(`list.ts:74-75`), 客户端按该字段拆分。
- 前端类型 `DictDataQuery.typeCode` 当前在两端都是 `string` (`apps/react-admin/src/api/rest/types.ts:140`、`apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts:37`), 需要拓宽为 `string | string[]` 才能传数组。
- 当前两端的「状态」列:
  - react-admin (`index.tsx:84-94` 左表, `:217-227` 右表): `valueEnum: { 1: { text: '启用' }, 0: { text: '禁用' } }`, 写死。
  - vue-vben (`data.ts:432-444` 左表, `:504-516` 右表): `formatter` 返回 `'启用' | '禁用'` 写死, 颜色按 `row.is_enabled === 1 ? 'success' : 'default'`。
- 当前两端的「归属平台」列:
  - react-admin (`index.tsx:124-203`): `valueEnum` 由 `SEARCH_PLATFORM_OPTIONS` 静态推导; `render` 直接渲染 `r.platform` 原字符串 + `r.tag_type` (但 `platform` 这条记录本身**没有** `tag_type`, 因为没种子)。  
  - vue-vben (`data.ts:473-489`): `cellRender` 颜色取自 `row.tag_type` 经 `NAIVE_TAG_TYPE_SET` 白名单过滤; 没有 `formatter`, 直接显示 `row.platform` 原字符串。

## Requirements

### R1. mock seed 补全 sys_platform 字典

- 在 `apps/backend-mock-template/utils/mock-data.ts` 增加 `sys_platform` 字典类型 + 3 条字典项 (general / react-admin / vue-admin), 作为「平台字段」的字典驱动源。
- 字典项字段 (value / label / tag_type / platform / sort / is_default) 与 06-28 design.md 「sys_platform 字典契约」表保持一致:
  - general → label `通用`, tag_type `''`
  - react-admin → label `React Admin`, tag_type `''`
  - vue-admin → label `Vue Admin`, tag_type `''`
- type_id 用新增 id, 不挤占 sys_switch_status 的 id=5。

### R2. react-admin 字典管理页面改造

- `apps/react-admin/src/pages/app/system/dict/index.tsx`:
  - 在 `DictPage` 顶层**一次**调用 `useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'], includeGeneral: true })`, 通过 `list.ts` 数组参数一次拿两份字典; 客户端按 `typeCode` 字段拆成 `switchStatusMap` / `platformMap`。 **`includeGeneral: true` 必须显式带**, 否则 `platform=react-admin` / `platform=vue-admin` 时拿不到 general 组, 字典项不全。
  - 把 `typeColumns` 与 `dataColumns` 中「状态」列的 `valueEnum` 改成基于 `sys_switch_status` 的运行时 map (按 value 字符串 `enabled`/`disabled` 映射, 显示用对应字典项的 `label`, 颜色用对应字典项的 `tag_type`)。
  - 把 `dataColumns` 中「归属平台」列的 `render` 改为根据 `sys_platform` 字典项查 label (`r.platform === item.value ? item.label : r.platform`), 颜色用对应字典项的 `tag_type`。
  - 把 `dataColumns` 中「归属平台」列的 `valueEnum` (用于搜索下拉) 改为根据 `sys_platform` 字典项动态生成; 同时保留 `SEARCH_PLATFORM_OPTIONS` 作为兜底 (加载未完成时)。 兜底与字典版切换由 `platformMap.size === 0` 决定。
  - 左表「状态」列同理 (虽然左表是 DictType, 但 is_enabled 字段同样适用 sys_switch_status)。
  - **key 转换**: `sys_switch_status` 的 value 是 `enabled`/`disabled`, 但数据库里 `is_enabled` 字段是 0/1 数值, 渲染时需要建立 1→enabled / 0→disabled 的映射。
- 性能/缓存: 一次 list 调用, queryKey = `['listDictData', { typeCode: [...], platform }]`, vue-query 自动按参数缓存, 不需要反复请求。
- **类型拓宽**: `apps/react-admin/src/api/rest/types.ts` 中 `DictDataQuery.typeCode` 拓宽为 `string | string[]` (兼容旧 string 调用)。

### R3. vue-vben 字典管理页面改造

- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`:
  - 在 setup 里**一次**调用 `useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'], includeGeneral: true })`, 通过 `list.ts` 数组参数一次拿两份字典; 客户端按 `typeCode` 字段拆成 `switchStatusDict` / `platformDict` (computed)。 **`includeGeneral: true` 必须显式带**。
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`:
  - 把 `useTypeColumns()` / `useDataColumns()` 改为接受参数: `(opts: { switchStatusDict?: DictData[]; platformDict?: DictData[] })`。
  - 「状态」列的 `formatter` 改为查 `switchStatusDict` 中 value=enabled → label=`启用`, tag_type=`success`; value=disabled → label=`禁用`, tag_type=`error` (按 is_enabled 数值 1/0 映射)。
  - 「归属平台」列的 `formatter` 改为查 `platformDict` 中 value=general/react-admin/vue-admin → label=通用/React Admin/Vue Admin, tag_type 经 `NAIVE_TAG_TYPE_SET` 白名单过滤后作为颜色。
  - 当 `switchStatusDict` / `platformDict` 未加载时 (空数组) 走兜底: 显示 `row.is_enabled === 1 ? '启用' : '禁用'` 与 `row.platform` 原字符串 (维持现状, 避免 hydration 闪烁)。
- **类型拓宽**: `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` 中 `DictDataQuery.typeCode` 拓宽为 `string | string[]`。

### R4. 跨端一致性验收

- mock 启动后:
  - `GET /api/system/dict-type/all` 包含 `sys_switch_status` 与 `sys_platform`。
  - `GET /api/system/dict-data/list?typeCode=sys_switch_status&platform=vue-admin&includeGeneral=true` 返回 4 条。
  - `GET /api/system/dict-data/list?typeCode=sys_platform` 返回 3 条 (general/react-admin/vue-admin)。
- 浏览器手动验证 (VITE_APP_PLATFORM=vue-admin / react-admin / general 三种):
  - 字典管理页面右表「状态」列: enabled 行用 tag_type=`success` 颜色, 显示 label=`启用`; disabled 行用 tag_type=`error` 颜色, 显示 label=`禁用`。
  - 「归属平台」列: platform=`general` 行显示 `通用`, platform=`react-admin` 行显示 `React Admin`, platform=`vue-admin` 行显示 `Vue Admin`。
- 两端 (react-admin / vue-vben) 表现一致 (允许 CellTag 颜色库略有差异, 但 label 必须相同)。

## Acceptance Criteria

- [ ] `apps/backend-mock-template/utils/mock-data.ts` 中 `sys_platform` 字典类型 + 3 条字典项种子就位 (general/react-admin/vue-admin)。
- [ ] mock 启动后, `GET /api/system/dict-type/all` 返回包含 `sys_platform`, `GET /api/system/dict-data/list?typeCode=sys_platform` 返回 3 条。
- [ ] `apps/react-admin/src/api/rest/types.ts` 与 `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` 中 `DictDataQuery.typeCode` 拓宽为 `string | string[]`, 旧的 string 调用仍兼容。
- [ ] react-admin `pages/app/system/dict/index.tsx` **一次**调用 `useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'] })` (而非两次), 客户端按 `typeCode` 字段拆成两份 map, 两列 `valueEnum`/`render` 改为基于字典项动态渲染。
- [ ] vue-vben `views/system/dict/index.vue` + `data.ts` 同上, **一次**调用 `useListDictData` 拿两份字典, 列定义改为基于字典项动态渲染。
- [ ] 两端 `useListDictData` 调用均显式带 `includeGeneral: true`, 保证 `platform=react-admin` / `platform=vue-admin` 时拉到的字典同时包含 general 组 (mock `list.ts` 默认 `includeGeneral=false`, 由调用方显式开启)。
- [ ] `is_enabled` 数值 0/1 与 `sys_switch_status` 字典 value `enabled`/`disabled` 之间的映射在两端一致实现 (1→enabled, 0→disabled)。
- [ ] 字典未加载完成时, 两端仍能渲染兜底 (不出现 undefined / 空白)。
- [ ] `pnpm --filter @backend-mock-template typecheck` 通过。
- [ ] `pnpm --filter @react-admin typecheck` 通过。
- [ ] `pnpm --filter @vben/web-naive typecheck` 通过。
- [ ] git status 干净 (或仅包含本次目标文件改动)。

## Out of Scope

- 后端 java-admin 的 SQL 同步 (java-admin 走独立 SQL, 本期不动)。
- `DictDataDrawer` 创建/编辑表单的 platform / is_enabled 字段 (本期只动列表渲染)。
- 字典项 i18n / 多语言字段。
- 字典项批量操作接口改造。
- `useDictCache` 实际加载逻辑补全。
- 把 `SEARCH_PLATFORM_OPTIONS` 完全替换为字典 (保留作为兜底与表单初始值来源, 实际渲染走字典)。

## Open Questions

- OQ1 (已确认): `sys_platform` 字典 tag_type 全部置空, 渲染时平台 CellTag 不着色 (只显示 label)。 这一点与 06-28 design.md 「sys_platform 字典契约」一致。
- OQ2 (本期 out of scope): 字典 typeId 与前端 valueEnum key 的双源不一致问题 (例如 `is_enabled` 是 0/1 数值, `sys_switch_status` value 是 enabled/disabled 字符串) — 本期在渲染层做映射, 不动数据库字段类型。