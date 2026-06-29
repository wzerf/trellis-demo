# Design: 三端字典管理页面状态 / 归属平台列改用字典 label + tag_type 渲染

## Architecture & Boundaries

### 涉及代码层

| 层 | 路径 | 职责 |
| --- | --- | --- |
| Mock seed | `apps/backend-mock-template/utils/mock-data.ts` | 新增 `sys_platform` 字典类型 + 3 条字典项种子 |
| Mock 接口 (复用) | `apps/backend-mock-template/api/system/dict-data/list.ts` | 已支持 `?typeCode[]=` 数组参数(行 29-41), 本期直接消费 |
| React 类型 | `apps/react-admin/src/api/rest/types.ts` | 把 `DictDataQuery.typeCode` 拓宽为 `string \| string[]` |
| Vue 类型 | `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` | 把 `DictDataQuery.typeCode` 拓宽为 `string \| string[]` |
| React 页面 | `apps/react-admin/src/pages/app/system/dict/index.tsx` | 通过 `useListDictData({ typeCode: ['sys_switch_status','sys_platform'] })` **一次拉取**, 客户端按 `typeCode` 拆分两份 map, 改写「状态」「归属平台」列 valueEnum/render |
| Vue 页面 | `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue` | 在 setup 同样**一次**拉取, 把 items 按 typeCode 拆分后传给 data.ts |
| Vue 列定义 | `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts` | `useTypeColumns` / `useDataColumns` 改为接受字典入参, 动态生成 formatter/颜色 |
| React hook (复用) | `apps/react-admin/src/api/hooks/dict.ts:119-140` | `useListDictData` 已存在, 本期直接消费 |
| Vue hook (复用) | `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts:139-156` | `useListDictData` 已存在, 本期直接消费 |

### 边界原则

- 字典数据已经在 mock seed 层完整, 本期**不**修改 mock 接口逻辑, 也不动 SQL。
- 不复用 `SEARCH_PLATFORM_OPTIONS` / `PLATFORM_OPTIONS` 静态列表做主要渲染源 — 它们退化为「未加载完时的兜底」与「表单 initialValue 来源」。
- 两端共用同一份「value → label」「value → tag_type」的查表策略, 差异只在 CellTag 颜色映射 (`NAIVE_TAG_TYPE_SET` vs antd Tag color 直传)。
- `is_enabled` 0/1 与 `sys_switch_status` value `enabled/disabled` 字符串之间的映射**放在渲染层**做 (1→enabled, 0→disabled), 不动数据库字段, 不动 seed value。

## Data Flow

### 字典数据加载 — **一次 list 调用拉取多个 typeCode** (本期方案, 用户已确认)

```
[DictPage mount]
  → useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'] })
      → GET /api/system/dict-data/list?typeCode[]=sys_switch_status&typeCode[]=sys_platform&platform=currentPlatform
      → items: [
          { typeCode: 'sys_switch_status', value: 'enabled',  label: '启用', tag_type: 'success', ... },
          { typeCode: 'sys_switch_status', value: 'disabled', label: '禁用', tag_type: 'error',   ... },
          { typeCode: 'sys_platform',      value: 'general',     label: '通用',         tag_type: '', ... },
          { typeCode: 'sys_platform',      value: 'react-admin', label: 'React Admin', tag_type: '', ... },
          { typeCode: 'sys_platform',      value: 'vue-admin',   label: 'Vue Admin',   tag_type: '', ... },
        ]
  → 客户端按 typeCode 字段拆分:
      switchStatusItems = items.filter(x => x.typeCode === 'sys_switch_status')
      platformItems     = items.filter(x => x.typeCode === 'sys_platform')
  → switchStatusMap: Map<value, DictData>
  → platformMap:     Map<value, DictData>
  → 注入到列定义 closure
```

> 选定此方案而非「两次独立 useListDictData」的原因: 用户要求"页面加载时直接通过 api, batch 获取 code 加载一次"。
> 选定此方案而非「新增 by-codes endpoint」的原因: 现有 `list.ts:29-41` 已经支持 `?typeCode[]=` 数组参数, 复用即可, 不增加 endpoint 数量。
> 类型层: 把 `DictDataQuery.typeCode` 拓宽为 `string | string[]`, 兼容旧的单字符串调用, 不破坏下游。

### 渲染时的映射

```
[DictData row]                [sys_switch_status dict]            [CellTag]
  is_enabled = 1         →    enabled 项 {label: '启用', tag_type: 'success'}  →  <Tag color='success'>启用</Tag>

[DictData row]                [sys_platform dict]                [CellTag]
  platform = 'vue-admin' →    vue-admin 项 {label: 'Vue Admin', tag_type: ''}  →  <Tag>Vue Admin</Tag>
```

### 兜底策略

- 字典未加载完成 (返回空数组) 时:
  - react-admin: `valueEnum` 走 `SEARCH_PLATFORM_OPTIONS` 静态列表; `is_enabled` 渲染走 `{1:'启用', 0:'禁用'}`。
  - vue-vben: `formatter` 返回 `row.is_enabled === 1 ? '启用' : '禁用'`, `row.platform` 原字符串显示。
- 这保证首屏不出现 undefined / 空白 / CellTag 不存在色的情况。

## Contracts

### sys_platform 字典类型契约 (新增种子)

| 字段 | 值 |
| --- | --- |
| type_code | `sys_platform` |
| type_name | `平台` |
| type_id | 新增 (建议 id=10, 避开 sys_switch_status=5 与 sys_user_sex=4 等已有 id) |

### sys_platform 字典项契约

| id | value | label | sort | is_default | platform | tag_type | is_enabled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2001 | general | 通用 | 1 | 1 | general | '' | 1 |
| 2002 | react-admin | React Admin | 2 | 0 | react-admin | '' | 1 |
| 2003 | vue-admin | Vue Admin | 3 | 0 | vue-admin | '' | 1 |

> id 仅 mock seed 自洽用, 与 SQL id 不必严格相等, 但**字段值**必须与 SQL 完全一致 (SQL 已 staged 见 06-28 任务)。
> tag_type 全部置空, 渲染时 platform CellTag 不着色 (按 PRD OQ1 已确认)。

### is_enabled ↔ sys_switch_status.value 映射契约

| `is_enabled` (数值) | `sys_switch_status.value` (字符串) | label | tag_type |
| --- | --- | --- | --- |
| 1 | enabled | 启用 | success |
| 0 | disabled | 禁用 | error |

> 跨平台维度 (general/react-admin/vue-admin) 渲染时取**当前 platform** 对应的字典项 (因为同一 value 不同 platform 下 label/tag_type 可能略有差异 — 实际 seed 中 label/tag_type 一致, 但 hook 默认按 platform 过滤, 故自动取到正确项)。

### React 列定义契约 (修改后)

```ts
// apps/react-admin/src/pages/app/system/dict/index.tsx

function buildSwitchStatusMap(items: DictData[]) {
  // value → { label, tag_type }
  return new Map(items.map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]));
}

function buildPlatformMap(items: DictData[]) {
  return new Map(items.map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]));
}

// 「状态」列 (左/右表共用) — render 改造
function renderIsEnabled(switchStatusMap: Map<string, {label: string; tag_type: string}>) {
  return (_: unknown, r: { is_enabled: number }) => {
    const valueKey = r.is_enabled === 1 ? 'enabled' : 'disabled';
    const found = switchStatusMap.get(valueKey);
    const label = found?.label ?? (r.is_enabled === 1 ? '启用' : '禁用');
    const tagType = found?.tag_type;
    return <Tag color={tagType && tagType !== 'default' ? tagType : undefined}>{label}</Tag>;
  };
}

// 「归属平台」列 — render 改造
function renderPlatform(platformMap: Map<string, {label: string; tag_type: string}>) {
  return (_: unknown, r: { platform: string }) => {
    const found = platformMap.get(r.platform);
    const label = found?.label ?? r.platform;
    const tagType = found?.tag_type;
    return <Tag color={tagType && tagType !== 'default' ? tagType : undefined}>{label}</Tag>;
  };
}
```

### Vue 列定义契约 (修改后)

```ts
// apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts

export function useTypeColumns(opts: {
  switchStatusDict?: DictData[];
} = {}): VbenTableColumn<DictType>[] {
  const switchStatusMap = new Map(
    (opts.switchStatusDict ?? []).map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]),
  );
  // ...
  // 「状态」列 formatter:
  formatter: ({ row }) => {
    const key = row.is_enabled === 1 ? 'enabled' : 'disabled';
    return switchStatusMap.get(key)?.label ?? (row.is_enabled === 1 ? '启用' : '禁用');
  },
  cellRender: ({ row }) => {
    const key = row.is_enabled === 1 ? 'enabled' : 'disabled';
    const tagType = switchStatusMap.get(key)?.tag_type;
    return { name: 'CellTag', props: { type: NAIVE_TAG_TYPE_SET.has(tagType ?? '') ? tagType : 'default' } };
  },
}

export function useDataColumns(opts: {
  switchStatusDict?: DictData[];
  platformDict?: DictData[];
} = {}): VbenTableColumn<DictData>[] {
  // ... 类似改造, 加上 platformDict 注入
}
```

## Compatibility & Migration Notes

- **数据库字段不动**: `is_enabled` 仍是 0/1 数值, `sys_switch_status.value` 仍是 enabled/disabled 字符串。 映射在渲染层完成, 不破坏下游消费 (java-admin / 其它业务模块仍按 0/1 读取)。
- **mock seed 新增**:`sys_platform` 字典类型 + 3 条字典项, 不动 `sys_switch_status` 已有种子 (与 06-28 任务对齐)。
- **Vue hook 已有**:vue-query 已全局挂载, `useListDictData` 已存在, 不需要再走 06-28 任务已完成的步骤。
- **React hook 已有**:`useListDictData` 已存在并自动注入 platform, 不需要新增。
- **SEARCH_PLATFORM_OPTIONS 不删**:作为兜底 + 表单 initialValue 来源保留。
- **不修改 dict-data drawer 表单**:本期只动列表渲染, 创建/编辑表单不在范围。

## Trade-offs

### is_enabled ↔ value 映射放渲染层 vs 后端

- **渲染层 (本期方案)**: 数据库保持 0/1 数值, 通用性更强; 不同业务模块可以按 0/1 直接读取; 缺点是每处渲染都要写一个 1→enabled / 0→disabled 的映射。
- **后端 (改造 DictData)**: 增加 `label` 字段冗余, 直接渲染; 缺点是破坏现有下游 (java-admin 仍按 0/1), 与 PRD OQ2 已确认的本期方案不一致。

选择 **渲染层**。

### 字典字典项 platform 过滤策略

- `useListDictData` 自动注入 `platform = currentPlatform`。 也就是说, 当前端 platform=vue-admin 时, 拉到的 `sys_switch_status` 只包含 vue-admin + (includeGeneral=true 时) general 两组, 不含 react-admin 组。
- 当前 sys_switch_status 同一 value 在不同 platform 下 label/tag_type **完全一致** (seed 已经验证), 所以即使只拉到当前 platform 组, 渲染结果仍然正确。
- **不需要**专门传 `includeGeneral=true` — `enabled`/`disabled` 两个 value 在 currentPlatform 组内已经存在。

### platform 列颜色策略

- `sys_platform` 字典项 tag_type 全部为空, 平台 CellTag 渲染时不传 color, 退化为纯文本 Tag (与 react-admin 现状、vue-vben 现状保持一致)。
- 不需要改 `NAIVE_TAG_TYPE_SET` 白名单。

## Rollback Considerations

- mock seed 改动: `git checkout -- apps/backend-mock-template/utils/mock-data.ts`
- react-admin 页面改动: `git checkout -- apps/react-admin/src/pages/app/system/dict/index.tsx`
- vue-vben 页面改动: `git checkout -- apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`

## Operational Notes

- mock 启动后直接验证字典类型/字典项:
  ```
  curl -s 'http://localhost:3005/api/system/dict-type/all' | jq '.data[] | {code, name}'
  # 应包含 sys_switch_status 与 sys_platform
  curl -s 'http://localhost:3005/api/system/dict-data/list?typeCode=sys_platform&platform=vue-admin' | jq '.data.items | length'
  # 期望: 2 (vue-admin + general, includeGeneral 默认为 true 见 dict-data/list.ts 既有行为; 或 1 仅 vue-admin — 以 list.ts 实际逻辑为准)
  ```
- 浏览器手动验证: 切换 `VITE_APP_PLATFORM` 三种模式, 字典管理页面右表「状态」「归属平台」两列显示正确。