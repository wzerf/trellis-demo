# dict hook 内置 fallback,React/Vue 端统一规范

## Goal

把 `sys_switch_status` / `sys_platform` 的字典-兜底逻辑从应用层搬到 hook 层:

- React (`apps/react-admin/src/api/hooks/dict.ts`) 与 Vue (`apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts`) 暴露**同一形状**的查表 API(`lookupSwitchLabel` / `lookupSwitchTagType` / `lookupPlatformLabel` / `lookupPlatformTagType` / `switchValueEnum` / `platformValueEnum`)。
- 业务页只调 helper,不再持有 `SWITCH_STATUS_FALLBACK` 或 `n === 1 ? '启用' : '禁用'` 这类散落的 fallback 常量。
- 把"hook 内置 fallback"作为前端 hook 层的通用约束写进 `.trellis/spec/frontend/hook-guidelines.md`,后续新增 hook 沿用。

## Background(现状速记)

### React (`apps/react-admin/src/pages/app/system/dict/index.tsx`)

- `useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'], includeGeneral: true })` 拉字典。
- 应用层做 5 件事,全部带 fallback:
  1. `SWITCH_STATUS_FALLBACK: Record<0|1, string> = { 1:'启用', 0:'禁用' }`(line 61-64)
  2. `buildDictMaps` 把 items 按 `typeCode` 拆成两个 `Map<value, { label, tagType }>`(line 70-84)
  3. `statusValueEnum` 构造 `Record<1|0, { text }>` 用于 ProTable `valueEnum`(line 105-114, 198-207)
  4. `renderStatus` 用 `hit?.label ?? SWITCH_STATUS_FALLBACK[fallbackNum]` 渲染 Tag(2 处)
  5. `renderPlatform` 用 `hit?.label ?? r.platform` 渲染 Tag
  6. `platformValueEnum` 在 dict 为空时兜底到 `SEARCH_PLATFORM_OPTIONS`(line 221-235)

### Vue (`apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`)

- `useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'], includeGeneral: true })` 拉字典。
- 应用层定义 4 个 lookup helper + 平台命中策略:
  1. `isEnabledKey(n)` — 把 0/1 转 'disabled'/'enabled'(line 114-116)
  2. `switchTagTypeFor(n)` — 平台优先命中 + NTag 白名单校验 + 兜底 `n === 1 ? 'success' : 'default'`(line 132-164)
  3. `switchLabelFor(n)` — 平台优先命中 + 兜底 `n === 1 ? '启用' : '禁用'`(line 165-174)
  4. `platformTagTypeFor(platform)` / `platformLabelFor(platform)` — 平台优先命中 + 兜底 raw value(line 190-227)
  5. 4 个 `lookup*` 包装函数(模板里调用)

### 共同问题

- 每条 fallback 都是「应用层硬编码一份」(label 兜底 / tagType 兜底 / platform 兜底 / valueEnum 兜底),任何一个改文案或加 typeCode 都得 4 个地方同时改。
- `value` ↔ `enabled`/`disabled` 字符串的映射 (`isEnabledKey`) 在两个端重复实现。
- 平台命中策略 React 端用 `Map.set` 后写覆盖,Vue 端用 `candidates.find(platform === DEFAULT_PLATFORM)`,行为靠 mock 数据顺序(general → current-platform)约束,脆弱。

## Scope

### In Scope

- **新增** hook `useDictLookups` (React) / `useDictLookups` (Vue,同名),挂在现有 dict hooks 文件里,与 `useListDictData` 并存(后者保留不变,作为薄 query wrapper)。
- **迁移** React `apps/react-admin/src/pages/app/system/dict/index.tsx` 与 Vue `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`:
  - 删除 `SWITCH_STATUS_FALLBACK` / `isEnabledKey` / `buildDictMaps` / `statusValueEnum` 构造 / `renderStatus` / `renderPlatform` 中的 fallback 三元
  - 改为消费 hook 返回的 helper
- **更新** `.trellis/spec/frontend/hook-guidelines.md`,把"hook 内置 fallback"作为新的「数据查询/展示 hook 通用原则」段落写进去。
- **保留** `useListDictData` 不变 — 它是薄 query wrapper,职责是「拉原始数据」,不应承担 fallback。
- **保留** `apps/react-admin/src/pages/app/system/dict/modules/shared.ts` 与 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts` 中的 `SEARCH_PLATFORM_OPTIONS` 等常量的导出位置不变;hook 通过参数接收(避免跨仓库共享)。

### Out of Scope

- 后端 mock / 接口契约(已在 `06-30-dict-data-camelcase-put-fix` 任务里完成 camelCase 化)。
- 抽屉 (`dict-data-drawer.tsx` / `dict-type-drawer.tsx` / `form.vue` / `form-type.vue`) — 这些不涉及 fallback,只用到 dict.label / dict.tagType 直接写值,不属于本次范围。
- 国际化(i18n) — fallback 文案当前就是中文,后续若引入 i18n 再单独做。
- `useDictCache` React 端兼容层(已 no-op,不在 scope)。
- 其他模块的 fallback 模式统一 — 仅在 hook-guidelines.md 里**声明原则**,不强制立即改造其他模块;后续按需逐个应用。

## Requirements

### R1:Hook 层契约(React + Vue 同形)

新增 `useDictLookups(options?)`,返回:

```ts
type DictLookups = {
  /** 把 isEnabled 0/1 翻译成 dict label;命中失败时返回 '启用' / '禁用' */
  lookupSwitchLabel: (n: 0 | 1 | number) => string;
  /** 返回 dict 的 tagType,需经 NTag 白名单过滤;命中失败时按 n 走 success/default */
  lookupSwitchTagType: (n: 0 | 1 | number) => TagType | undefined;
  /** 把 platform code 翻译成 dict label;命中失败时返回原 platform 或传入的 fallbackLabel */
  lookupPlatformLabel: (platform: string | undefined) => string;
  /** 返回 dict 的 tagType,需经 NTag 白名单过滤;命中失败时返回 undefined */
  lookupPlatformTagType: (platform: string | undefined) => TagType | undefined;
  /** ProTable / vxe-grid 的 status 列 valueEnum(text = label) */
  switchValueEnum: Record<0 | 1, { text: string }>;
  /** 归属平台列 valueEnum;dict 命中时用 dict label,未命中时用传入的 platformLabels 兜底 */
  platformValueEnum: Record<string, { text: string }>;
  /** 字典是否已加载过至少一次(用于决定 platformValueEnum 是否完全由 platformLabels 兜底) */
  loaded: boolean;
};
```

### R2:参数形态

```ts
type UseDictLookupsOptions = {
  /** 额外要拉的字典类型;默认 ['sys_switch_status', 'sys_platform'] */
  typeCodes?: string[];
  /** 是否包含 general 平台;默认 true(与现有 dict 页行为对齐) */
  includeGeneral?: boolean;
  /** platform valueEnum 的兜底标签,例如 { general: '通用', 'react-admin': 'React Admin' } */
  platformLabels?: Record<string, string>;
};
```

- platformLabels 不传 → `platformValueEnum` 在 dict 为空时使用 raw value 作为 text(不推荐,但可用)。
- platformLabels 传入 → `platformValueEnum` 在 dict 为空时使用传入的 label 作为 text。

### R3:平台命中策略统一

hook 内部对 `sys_switch_status` / `sys_platform` 的多条候选(general + current-platform)采用 Vue 同款的优先级:
1. `candidates.find(d => d.platform === CURRENT_PLATFORM)`
2. `candidates.find(d => d.tagType)`
3. `candidates[0]`

React 端 `buildDictMaps` 的 `Map.set` 后写覆盖策略被替换;由于 mock 顺序 general → current-platform,实际行为与现状一致,但**显式声明**平台命中策略,后续调整 seed 顺序不再脆弱。

### R4:React 端 UI 层迁移

`apps/react-admin/src/pages/app/system/dict/index.tsx`:
- 删除 `SWITCH_STATUS_FALLBACK` 常量(line 61-64)
- 删除 `isEnabledKey` / `buildDictMaps` 函数(line 66-84)
- 删除 `buildTypeColumns` / `buildDataColumns` 中的 `statusValueEnum` 构造(line 105-114, 198-207)
- `renderStatus` / `renderPlatform` 改为调用 hook 返回的 helper
- `buildTypeColumns` / `buildDataColumns` 的 `switchStatusMap` / `platformMap` 参数移除,改用 hook helper
- `DictPage` 组件中 `useMemo(buildDictMaps, ...)` 改为 `const dictLookups = useDictLookups()`
- 列定义构造函数的签名相应简化

### R5:Vue 端 UI 层迁移

`apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`:
- 删除 `isEnabledKey` / `switchTagTypeFor` / `switchLabelFor` / `platformTagTypeFor` / `platformLabelFor` / 4 个 `lookup*` 包装函数(line 114-242)
- 删除 `switchStatusDict` / `platformDict` 这两个 computed(line 100-107)
- 模板里 `<template #dict_status>` / `<template #dict_platform>` 直接用 hook 返回的 helper
- 新增 `const dictLookups = useDictLookups()` 一行
- `SEARCH_PLATFORM_OPTIONS` 仍由 `data.ts` 提供,作为参数传入 hook

### R6:Spec 沉淀

`.trellis/spec/frontend/hook-guidelines.md` 新增段落:

- **「数据查询/展示 hook 的 fallback 原则」**:hook 在返回查表 / label / valueEnum 时,**必须**自带 fallback(静态常量或参数注入的兜底),应用层不应再持有 fallback 常量或写 `xxx ?? '兜底文案'` 这类表达式。
- **「valueEnum 兜底」**:当 hook 返回的 `valueEnum` 需要友好文案时,允许通过参数注入 label map;不传时退化为 raw value。
- **「新增 fallback 类型时」**:fallback 必须和 hook 同文件修改,不在应用层添加。
- 配套一个最小示例代码片段(展示 hook helper vs 散落 fallback 的差异)。

### R7:现有 contract 不破坏

- `useListDictData` 签名与行为不变(查询 wrapper)。
- 现有 `dict-data-drawer.tsx` / `dict-type-drawer.tsx` / `form.vue` 等表单逻辑不受影响(它们直接读 `dict.label` / `dict.tagType` 写值,不依赖 fallback)。
- `SEARCH_PLATFORM_OPTIONS` / `PLATFORM_OPTIONS` / `TAG_TYPE_OPTIONS` 等常量位置不变。

## Constraints

- **同形契约**:React hook 和 Vue hook 必须返回**同名、同形、同语义的 helper**,确保应用层代码跨端对齐。
- **不引入跨仓库共享包**:SEARCH_PLATFORM_OPTIONS 由各自仓库的 `shared.ts` / `data.ts` 提供,通过参数传入 hook,避免新增 `packages/shared` 之类的额外抽象。
- **不修改 mock 数据顺序假设**:统一使用「平台优先命中」显式策略,即便 mock 数据顺序变化行为也正确。
- **fallback 文案不变**:`'启用' / '禁用' / 'success' / 'default' / 'general' 等保留现状,本次不改文案。
- **视觉不变**:React 端的「dict.tagType === 'default' 或缺失时不传 color」与 Vue 端的「dict.tagType 不在 NTag 白名单时回退 success/default」行为**完全保留**,只在 hook 层封装,不重新调整。

## Acceptance Criteria

- [ ] `apps/react-admin/src/api/hooks/dict.ts` 导出 `useDictLookups(options?)`,返回 R1 列出的全部字段。
- [ ] `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts` 导出 `useDictLookups(options?)`,返回同名同形的全部字段。
- [ ] React `pages/app/system/dict/index.tsx` 中 `SWITCH_STATUS_FALLBACK`、`isEnabledKey`、`buildDictMaps`、`statusValueEnum` 构造、`renderStatus`/`renderPlatform` 的 `?? '启用'` / `?? '禁用'` 三元**全部删除**,替换为 hook helper 调用。
- [ ] Vue `views/system/dict/index.vue` 中 `isEnabledKey`、`switchTagTypeFor`、`switchLabelFor`、`platformTagTypeFor`、`platformLabelFor`、4 个 `lookup*` 包装函数、`switchStatusDict` / `platformDict` computed**全部删除**,模板插槽改为调用 hook helper。
- [ ] React `pnpm -C apps/react-admin typecheck` 通过。
- [ ] Vue `pnpm -C apps/vue-vben-admin typecheck:web-naive` 通过(若命令存在)。
- [ ] React dev 启动,字典管理页「状态 / 归属平台」列在 mock 字典正常 / 字典为空 / 字典缺 typeCode 三种情形下视觉与现状一致(颜色、文案、对齐均无回退)。
- [ ] Vue dev 启动,字典管理页同上三情形视觉一致。
- [ ] `.trellis/spec/frontend/hook-guidelines.md` 新增 R6 列出的「数据查询/展示 hook 的 fallback 原则」段落,含最小代码示例。
- [ ] `trellis-check` 通过,无 P0/P1 阻断项。

## Notes

- 本次只把 fallback **搬家**,不改文案/不改视觉/不改 mock 顺序;后续如要换文案,只动 hook 文件。
- 平台命中策略统一为「显式平台优先」,未来 mock 顺序调整无需同步改应用层。
- 其他模块(用户管理 / 角色管理等)的 fallback 模式未在本次范围,但 spec 写好后,后续改造可以基于同样的 hook helper 形态。