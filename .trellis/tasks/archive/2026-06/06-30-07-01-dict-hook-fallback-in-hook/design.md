# dict hook 内置 fallback — 技术设计

## 1. 边界与契约

### 1.1 责任划分

| 层 | 职责 | 不应承担 |
| --- | --- | --- |
| `useListDictData` | 薄 query wrapper:合并 `platform`,打 queryKey,返回 react/vue-query 原生对象 | fallback、map 拆解、valueEnum 构造 |
| `useDictLookups` (新) | 字典加载 + fallback + 查表 helper + valueEnum 构造 | 业务调用 / 渲染 |
| 业务页 / 列定义 | 调用 `useDictLookups` 返回的 helper | 持有 `SWITCH_STATUS_FALLBACK`、三元兜底、平台命中策略 |

### 1.2 React hook API

```ts
// apps/react-admin/src/api/hooks/dict.ts (新增)

export interface DictLookups {
  lookupSwitchLabel: (n: 0 | 1 | number) => string;
  lookupSwitchTagType: (n: 0 | 1 | number) => string | undefined;
  lookupPlatformLabel: (platform: string | undefined) => string;
  lookupPlatformTagType: (platform: string | undefined) => string | undefined;
  switchValueEnum: Record<0 | 1, { text: string }>;
  platformValueEnum: Record<string, { text: string }>;
  loaded: boolean;
}

export interface UseDictLookupsOptions {
  typeCodes?: string[];
  includeGeneral?: boolean;
  platformLabels?: Record<string, string>;
}

export function useDictLookups(options: UseDictLookupsOptions = {}): DictLookups {
  // ...
}
```

### 1.3 Vue hook API

```ts
// apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts (新增)

import type { ComputedRef } from 'vue';

export interface DictLookups {
  lookupSwitchLabel: (n: 0 | 1 | number) => string;
  lookupSwitchTagType: (n: 0 | 1 | number) => string | undefined;
  lookupPlatformLabel: (platform: string | undefined) => string;
  lookupPlatformTagType: (platform: string | undefined) => string | undefined;
  switchValueEnum: ComputedRef<Record<0 | 1, { text: string }>>;
  platformValueEnum: ComputedRef<Record<string, { text: string }>>;
  loaded: ComputedRef<boolean>;
}

export interface UseDictLookupsOptions {
  typeCodes?: string[];
  includeGeneral?: boolean;
  platformLabels?: Record<string, string>;
}

// options 接受 MaybeRefOrGetter<UseDictLookupsOptions>,与其他 hook 保持一致
export function useDictLookups(options?: MaybeRefOrGetter<UseDictLookupsOptions>): DictLookups {
  // ...
}
```

注:Vue 用 `ComputedRef` 包住,因为数据加载是 reactive 的;React 用纯对象(useMemo 已 cache,值在 render 时即定)。

### 1.4 NTag preset 集合:不放在 hook 层

- React antd `Tag color` 接受 16 项预设;Vue naive-ui `NTag type` 只接受 6 项。
- hook **不做**事先白名单过滤:`lookupSwitchTagType` / `lookupPlatformTagType` 直接返回 `dict.tagType`(字符串)或 fallback,保持 hook 语义框架无关。
- 框架层的 UI 兜底(如 Vue NTag 的白名单)由各端 `renderStatus` / `renderPlatform` 按需处理。
- 这样不会误伤 React 端可能用到的非 7 项 preset color(例如 `'magenta'` / `'volcano'` 等目前在 `TAG_TYPE_OPTIONS` 下拉里可选、未来可能用作字典值的项)。

### 1.5 fallback 文案与色值

| helper | 命中 dict | 命中失败 |
| --- | --- | --- |
| `lookupSwitchLabel(n)` | `dict.label` | `n === 1 ? '启用' : '禁用'` |
| `lookupSwitchTagType(n)` | `dict.tagType`(若在 preset set 内) | `n === 1 ? 'success' : 'default'` |
| `lookupPlatformLabel(p)` | `dict.label` | `p`(原始 value,或 `p` 未传则返回 `'-'`) |
| `lookupPlatformTagType(p)` | `dict.tagType`(若在 preset set 内) | `undefined` |
| `switchValueEnum[k]` | `text: lookupSwitchLabel(k)` | 同上(经 lookup) |
| `platformValueEnum[v]` | dict 命中 → `text: dict.label`;否则若 `platformLabels[v]` → 用之;否则用 `v` | — |

## 2. Hook 内部实现要点

### 2.1 复用 useListDictData

```ts
// React
const merged: DictDataQuery = {
  typeCode: typeCodes ?? ['sys_switch_status', 'sys_platform'],
  includeGeneral: includeGeneral ?? true,
};
const { data } = useListDictData(merged);
const items = data?.items ?? [];
```

```ts
// Vue (在 watchEffect / computed 里 unwrap)
const stableOptions = unwrap(options, {} as UseDictLookupsOptions);
const merged = computed<DictDataQuery>(() => ({
  typeCode: stableOptions.typeCodes ?? ['sys_switch_status', 'sys_platform'],
  includeGeneral: stableOptions.includeGeneral ?? true,
}));
const { data } = useListDictData(merged);
```

### 2.2 平台命中策略

```ts
function pickPreferred(
  candidates: DictData[],
  currentPlatform: string,
): DictData | undefined {
  return (
    candidates.find((d) => d.platform === currentPlatform) ??
    candidates.find((d) => d.tagType) ??
    candidates[0]
  );
}
```

应用到所有 sys_switch_status / sys_platform 的候选:

```ts
const switchByValue = new Map<string, DictData[]>();
const platformByValue = new Map<string, DictData[]>();
for (const d of items) {
  const bucket =
    d.typeCode === 'sys_switch_status' ? switchByValue :
    d.typeCode === 'sys_platform' ? platformByValue : null;
  if (!bucket) continue;
  const arr = bucket.get(d.value) ?? [];
  arr.push(d);
  bucket.set(d.value, arr);
}
const switchHits = new Map<string, DictData>(
  [...switchByValue.entries()].map(([v, candidates]) => [v, pickPreferred(candidates, CURRENT_PLATFORM)!]),
);
const platformHits = new Map<string, DictData>(
  [...platformByValue.entries()].map(([v, candidates]) => [v, pickPreferred(candidates, CURRENT_PLATFORM)!]),
);
```

### 2.3 helper 实现

```ts
const SWITCH_LABEL_FALLBACK: Record<0 | 1, string> = { 1: '启用', 0: '禁用' };
const SWITCH_TAG_TYPE_FALLBACK: Record<0 | 1, NTagPreset> = { 1: 'success', 0: 'default' };
const IS_ENABLED_KEY: Record<0 | 1, 'enabled' | 'disabled'> = { 1: 'enabled', 0: 'disabled' };

function isEnabledKey(n: number): 'enabled' | 'disabled' {
  return n === 1 ? 'enabled' : 'disabled';
}

function lookupSwitchLabel(n: number): string {
  const hit = switchHits.get(isEnabledKey(n));
  return hit?.label ?? SWITCH_LABEL_FALLBACK[(n === 1 ? 1 : 0)];
}

function lookupSwitchTagType(n: number): string | undefined {
  const hit = switchHits.get(isEnabledKey(n));
  // 不做白名单过滤:返回原始 tagType,框架层按需处理。
  return hit?.tagType ?? SWITCH_TAG_TYPE_FALLBACK[n === 1 ? 1 : 0];
}

function lookupPlatformLabel(p: string | undefined): string {
  if (!p) return '-';
  const hit = platformHits.get(p);
  return hit?.label ?? p;
}

function lookupPlatformTagType(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const hit = platformHits.get(p);
  return hit?.tagType; // platform tagType 无 fallback;未命中返回 undefined
}
```

### 2.4 valueEnum 构造

```ts
const switchValueEnum: Record<0 | 1, { text: string }> = {
  1: { text: lookupSwitchLabel(1) },
  0: { text: lookupSwitchLabel(0) },
};

const platformValueEnum: Record<string, { text: string }> = {};
if (items.length === 0) {
  // dict 还没拉回来 → 用 platformLabels 兜底
  const labels = platformLabels ?? {};
  for (const v of Object.keys(labels)) {
    platformValueEnum[v] = { text: labels[v] };
  }
} else {
  // dict 已加载:优先 dict.label,缺值用 platformLabels,再缺用 raw value
  const labels = platformLabels ?? {};
  for (const [v, hit] of platformHits.entries()) {
    platformValueEnum[v] = { text: hit.label };
  }
  for (const [v, label] of Object.entries(labels)) {
    if (!platformValueEnum[v]) platformValueEnum[v] = { text: label };
  }
}
```

注意 Vue 端需要 `computed`,因为 `data` 是 reactive ref。

## 3. 前端改造清单

### 3.1 React-Admin

| 文件 | 改动 |
| --- | --- |
| `apps/react-admin/src/api/hooks/dict.ts` | 新增 `useDictLookups` + `N_TAG_PRESET_SET` + `DictLookups`/`UseDictLookupsOptions` 类型导出。`useListDictData` 不变。 |
| `apps/react-admin/src/pages/app/system/dict/index.tsx` | 删除 `SWITCH_STATUS_FALLBACK` / `isEnabledKey` / `buildDictMaps` / `DictDict` / `statusValueEnum` 构造;`buildTypeColumns` / `buildDataColumns` 不再接受 map 参数;改为在 `DictPage` 里 `const dictLookups = useDictLookups()`,列定义通过 `dictLookups.lookupSwitchLabel(n)` / `dictLookups.lookupSwitchTagType(n)` 等渲染。 |

`buildTypeColumns` / `buildDataColumns` 重构后:

```ts
function buildTypeColumns(
  dictLookups: DictLookups,
  renderOption: (...) => React.ReactNode[],
): ProColumns<DictType>[] {
  const statusValueEnum = dictLookups.switchValueEnum;
  const renderStatus = (_: unknown, r: { isEnabled: number }) => {
    const tagType = dictLookups.lookupSwitchTagType(r.isEnabled);
    return (
      <Tag color={tagType && tagType !== 'default' ? tagType : undefined}>
        {dictLookups.lookupSwitchLabel(r.isEnabled)}
      </Tag>
    );
  };
  return [
    /* ... */
    {
      title: '状态',
      dataIndex: 'isEnabled',
      width: 90,
      search: false,
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: renderStatus,
    },
    /* ... */
  ];
}
```

注意 React 端保留 `tagType !== 'default' ? tagType : undefined` 这一行的 React-特异性视觉(无颜色),仅是 hook 返回值的「展示策略」,不属于 fallback。fallback 仅由 hook 提供。

### 3.2 Vue-Vben-Admin

| 文件 | 改动 |
| --- | --- |
| `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts` | 新增 `useDictLookups` + `N_TAG_PRESET_SET` + 类型导出。`useListDictData` 不变。 |
| `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue` | 删除 `isEnabledKey` / `switchTagTypeFor` / `switchLabelFor` / `platformTagTypeFor` / `platformLabelFor` / 4 个 `lookup*` 函数 / `switchStatusDict` / `platformDict` computed;模板插槽直接 `dictLookups.lookupSwitchLabel(...)` 等调用。 |

模板插槽改写:

```vue
<template #dict_status="{ row }">
  <NTag
    :type="dictLookups.lookupSwitchTagType(row.isEnabled as 0 | 1)"
    size="small"
  >
    {{ dictLookups.lookupSwitchLabel(row.isEnabled as 0 | 1) }}
  </NTag>
</template>
```

### 3.3 Spec

| 文件 | 改动 |
| --- | --- |
| `.trellis/spec/frontend/hook-guidelines.md` | 新增「数据查询/展示 hook 的 fallback 原则」段落,含最小代码示例。 |

## 4. 数据流 / 字段流图

```
React/Vue 页面
   │
   │ useDictLookups({ typeCodes, includeGeneral, platformLabels })
   ▼
┌──────────────────────────────────────────────┐
│ useDictLookups                                │
│   ├── useListDictData(merged)                 │
│   │      └── react/vue-query cache key 区分   │
│   ├── items = data?.items ?? []               │
│   ├── switchByValue / platformByValue 拆桶    │
│   ├── pickPreferred (平台优先命中)              │
│   ├── switchHits / platformHits Map           │
│   └── helper functions + valueEnum 构造       │
└──────────────────────────────────────────────┘
   │
   │ dictLookups.lookupSwitchLabel / TagType / ...
   ▼
ProTable valueEnum / renderStatus / NTag 插槽
```

## 5. 权衡与兼容性

- **保留 `useListDictData`**:它作为 query wrapper 职责清晰,后续其他模块若只需拉原始数据不必走 fallback 逻辑。`useDictLookups` 内部直接调用它,二者无冲突。
- **不引入跨仓库共享包**:跨端类型对齐靠「人工维护同形契约」(本次任务的关键产物之一就是统一两端 helper 签名),不靠 `packages/shared`。等真正出现第 3 个端再考虑抽公共包。
- **NTag preset set 选择 7 项**:Vue 6 项 + `processing`。React 端 16 项的预设不在 hook 中处理,留给 antd Tag 默认行为(应用层不需要传 preset 之外的 color)。如果未来 React 引入非 preset 字典色,需要扩展 preset set 并更新文档。
- **`lookupPlatformLabel` 返回 `'-'`**:与 Vue 现状一致(当 platform 为 undefined 时显示 `'-'`);React 端现状是「dict 命中失败时回退 raw value」,若 platform 是 undefined 仍然返回 `'-'`。保持 Vue 行为对齐,React 也用同一规则。
- **`platformValueEnum` 兜底粒度**:仅在 `items.length === 0`(字典一次都没拉到)时用 `platformLabels` 兜底;一旦拉到,dict 命中覆盖 dict label,缺值由 `platformLabels` 补,再缺用 raw value。这与 React 现状 (`platformMap.size > 0 ? dict : SEARCH_PLATFORM_OPTIONS`) 行为一致。

## 6. 上线 / 回滚

- 单仓单 PR,拆 3 个 commit:
  1. `feat(dict-hook): add useDictLookups in react-admin with built-in fallback`
  2. `feat(dict-hook): add useDictLookups in vue-vben-admin with built-in fallback`
  3. `refactor(dict-ui): consume useDictLookups on React + Vue pages; drop scattered fallback`
  4. `docs(frontend-spec): add fallback-in-hook convention to hook-guidelines.md`
- 回滚:任一 commit 可独立 revert;若整体回滚,dict 页行为回到现状(散落 fallback)。
- 不需要 feature flag:helper 行为与现状等价,纯封装。

## 7. 风险

- **React antd Tag 16 项色值可能用到 `processing`**:`N_TAG_PRESET_SET` 包含 `processing`,且 React 现状 `tagType` 字段也支持(虽然 mock 中未使用)。如未来 antd 引入新的 preset color 但应用代码已经在用,需同步扩展 preset set。监控:`grep -r 'tagType' apps/backend-mock-template`。
- **`useListDictData` queryKey 缓存命中**:由于本次仅在 hook 内部包装 `useListDictData`,不修改它的 queryKey,React / Vue 现有的字典缓存继续工作,无缓存击穿风险。
- **Vue `useDictLookups` options 必须是 reactive 还是常量**:为对齐 `useListDictData` 的 `MaybeRefOrGetter<DictDataQuery>` 风格,options 接受 `MaybeRefOrGetter<UseDictLookupsOptions>`,但内部 unwrap 一次拿 stable 值(避免 watchEffect 反复触发)。这与 hooks.ts 里现有 `unwrap` 工具一致。
- **跨仓库类型同步**:两个仓库的 `DictLookups` / `UseDictLookupsOptions` 是手工维护的两份;后续若修改,需在两个仓库同步。本次不在范围,后续如频繁修改可考虑 codegen。
- **Vue dict 页的 `SEARCH_PLATFORM_OPTIONS`**:作为参数从 `data.ts` 注入 hook;若未来 `SEARCH_PLATFORM_OPTIONS` 内容调整,需同步更新 dict 页调用点的 `platformLabels` 参数(若 hook 默认行为变更则需同步更新 hook 默认值)。