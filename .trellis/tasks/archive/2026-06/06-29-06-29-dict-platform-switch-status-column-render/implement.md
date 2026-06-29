# Implement: 三端字典管理页面状态 / 归属平台列改用字典 label + tag_type 渲染

## Review-gate contract: explicit-selection-v1

```
Review-gate contract: explicit-selection-v1
Optional review gates status: configured
Enabled optional review gates: trellis-spec-review, trellis-code-review
Disabled optional review gates: trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review

策略:
- 开发模式:subagent(轻量,改 3 个端 4 个文件 + 新增 mock seed 一段,无需 worktree 隔离)
- 分支:master(单任务小改动,不另开分支)
- 流程:default(非 TDD)
- 架构审查:disabled
```

> 注: 任务涉及三端代码同步但只是渲染层调整, `trellis-spec-review` 用于核对 prd.md / design.md / implement.md 一致性, `trellis-code-review` 用于审实现正确性。 其余三个 review 闸门与本期改动的范围不匹配 (架构重构 / 深度重构 / merge), 故关闭。

## 实施清单

### Step 0: 拓宽 DictDataQuery.typeCode 为 string | string[]

**文件**:
- `apps/react-admin/src/api/rest/types.ts` (DictDataQuery interface, typeCode 字段)
- `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` (DictDataQuery interface, typeCode 字段)

**改动**:
```ts
// 旧
typeCode?: string;
// 新
typeCode?: string | string[];
```

**理由**: mock `list.ts:29-41` 已支持 `?typeCode[]=` 数组参数, 本期只调用一次就能拉多个 typeCode 的字典, 不需要新增 endpoint。 类型拓宽让前端能直接传数组而不绕路。 旧的 `string` 调用全部仍兼容, 不破坏下游。

**验收**:
- `pnpm --filter @backend-mock-template typecheck` 通过 (mock 不依赖前端类型)
- `pnpm --filter @react-admin typecheck` 通过
- `pnpm --filter @vben/web-naive typecheck` 通过

### Step 1: mock seed 补 sys_platform 字典

**文件**: `apps/backend-mock-template/utils/mock-data.ts`

**改动**:
1. `buildDictTypeSeeds()`: 新增一条字典类型
   ```ts
   { id: 10, code: 'sys_platform', name: '平台', remark: '', sort: 10, is_enabled: 1, deleted_at: 0, created_at: ..., updated_at: ... }
   ```
   (具体字段以 `DictType` 类型为准, 见 `mock-data.ts:443-454`)

2. `buildDictDataSeeds()`: 新增 3 条 `sys_platform` 字典项 (type_id=10):
   ```ts
   { id: 2001, type_id: 10, value: 'general',     label: '通用',         sort: 1, is_default: 1, platform: 'general',     tag_type: '', is_enabled: 1, deleted_at: 0, ... },
   { id: 2002, type_id: 10, value: 'react-admin', label: 'React Admin', sort: 2, is_default: 0, platform: 'react-admin', tag_type: '', is_enabled: 1, deleted_at: 0, ... },
   { id: 2003, type_id: 10, value: 'vue-admin',   label: 'Vue Admin',   sort: 3, is_default: 0, platform: 'vue-admin',   tag_type: '', is_enabled: 1, deleted_at: 0, ... },
   ```
   注意: `sys_platform` 字典项的 `platform` 字段必须与 `value` 一致 (general 项的 platform=general, 以此类推)。 这样 mock list 接口按 platform 过滤时, 当前前端 platform 仍能拉到自己的平台项。

**验收**:
- mock 启动后 `GET /api/system/dict-type/all` 包含 `sys_platform` (code)
- `GET /api/system/dict-data/list?typeCode=sys_platform&platform=vue-admin&includeGeneral=true` 返回 2 条 (vue-admin + general, 顺序按 sort 升序)
- `GET /api/system/dict-data/list?typeCode=sys_platform&platform=general` 返回 1 条 (仅 general)
- `GET /api/system/dict-data/list?typeCode=sys_platform` 不带 platform 返回 3 条

### Step 2: react-admin 字典页面改造

**文件**: `apps/react-admin/src/pages/app/system/dict/index.tsx`

**改动**:

1. **新增 import**:
   ```ts
   import { useListDictData } from '@/api/hooks/dict';
   ```

2. **顶层一次拉取两份字典** (在 `DictPage` 函数体内, 与现有 `useState`/`useEffect` 平级):
   ```ts
   const { data: dictPage } = useListDictData({
     typeCode: ['sys_switch_status', 'sys_platform'],
   });
   const switchStatusMap = useMemo(() => {
     const items = (dictPage?.items ?? []).filter((d) => d.typeCode === 'sys_switch_status');
     return new Map(items.map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]));
   }, [dictPage]);
   const platformMap = useMemo(() => {
     const items = (dictPage?.items ?? []).filter((d) => d.typeCode === 'sys_platform');
     return new Map(items.map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]));
   }, [dictPage]);
   ```
   注意: 依赖 `useMemo` 的 deps 用 `dictPage` (对象引用), 字典数据更新时 (同一 queryKey 不会重发请求) 引用稳定, 不会触发 re-render; 真正的 re-render 由 React Query 内部触发。

3. **改造 `typeColumns` 中「状态」列** (现 `index.tsx:84-94`):
   - 把模块级 `valueEnum` 改为函数 / 在组件内基于 `switchStatusMap` 重建。
   - 由于 `typeColumns` 是模块级常量, 改为把列定义搬入 `DictPage` 函数体内, 通过 closure 访问 `switchStatusMap`。
   - 或: 提取 `renderStatusColumn(switchStatusMap)` 与 `buildStatusValueEnum(switchStatusMap)` 两个工具函数, 在 `DictPage` 顶部调用后展开 `typeColumns`。
   - `valueEnum` 仍用 `{ 1, 0 }` 作 key, 但 `text` 从 `switchStatusMap.get('enabled')?.label ?? '启用'` 取 (兜底保留 06-29-design §「is_enabled ↔ value 映射契约」)。
   - `search: false` 保留, 不在搜索栏放该字段。

4. **改造 `dataColumns` 中「状态」列** (现 `index.tsx:217-227`): 同上, 兜底映射。

5. **改造 `dataColumns` 中「归属平台」列** (现 `index.tsx:124-203`):
   - `valueEnum` (搜索下拉): 改为基于 `platformMap` 动态生成, 同时保留 `SEARCH_PLATFORM_OPTIONS` 作为未加载完时的兜底 (`platformMap.size === 0` 时使用静态列表)。
   - `render` (现 `:147-154`): 改为根据 `platformMap.get(r.platform)?.label` 取 label, `tag_type` 同理; 兜底保留 `r.platform` 原字符串。
   - `renderFormItem` (搜索区组合 Select + 复选框) **不动**, 仍用 `SEARCH_PLATFORM_OPTIONS` 与 `getCurrentPlatform()` 兜底。
   - **搜索下拉的 valueEnum 生成规则**: `platformMap.size > 0` 时用 `[...platformMap.entries()].map(([value, { label }]) => ({ value, text: label }))`; 否则兜底 `SEARCH_PLATFORM_OPTIONS.reduce(...)`。 这样保证首屏搜索下拉也有 label (即使 dict 还在 fetch, 也会因为是静态 fallback 立即出现; fetch 完成后立刻替换为字典版)。

6. **保留**:
   - `fetchTypeRows` / `fetchEntryRows` 函数逻辑 (列表数据查询走原 `listDictTypeApi` / `listDictDataApi`)。
   - 抽屉 (`DictTypeDrawer` / `DictDataDrawer`) 不动。
   - `typeOptions` (新增条目下拉) 不动。

**验收**:
- `pnpm --filter @react-admin typecheck` 通过
- 浏览器手动验证: VITE_APP_PLATFORM=vue-admin 时, 右表「状态」列 enabled 行显示「启用」(success 绿)、disabled 行显示「禁用」(error 红); 「归属平台」列 vue-admin 行显示「Vue Admin」、general 行显示「通用」。

### Step 3: vue-vben 字典 data.ts 列定义改造

**文件**: `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`

**改动**:

1. **修改 `useTypeColumns()` 签名**: 接受可选入参:
   ```ts
   export function useTypeColumns(opts: { switchStatusDict?: DictData[] } = {}): VxeTableGridOptions['columns'] {
     const switchStatusMap = new Map(
       (opts.switchStatusDict ?? []).map((d) => [d.value, { label: d.label, tag_type: d.tag_type }]),
     );
     return [
       // ...
       {
         cellRender: {
           name: 'CellTag',
           props: ({ row }: { row: DictType }) => {
             const key = row.is_enabled === 1 ? 'enabled' : 'disabled';
             const tagType = switchStatusMap.get(key)?.tag_type;
             return {
               color:
                 tagType && NAIVE_TAG_TYPE_SET.has(tagType) ? tagType : (row.is_enabled === 1 ? 'success' : 'default'),
             };
           },
         },
         field: 'is_enabled',
         title: '状态',
         width: 90,
         formatter: ({ row }: { row: DictType }) => {
           const key = row.is_enabled === 1 ? 'enabled' : 'disabled';
           return switchStatusMap.get(key)?.label ?? (row.is_enabled === 1 ? '启用' : '禁用');
         },
       },
       // ...
     ];
   }
   ```

2. **修改 `useDataColumns()` 签名**: 接受可选入参 `{ switchStatusDict?: DictData[]; platformDict?: DictData[] }`, 改造:
   - **「归属平台」列** (现 `:473-489`):
     ```ts
     formatter: ({ row }: { row: DictData }) => {
       const found = platformMap.get(row.platform);
       return found?.label ?? row.platform;
     },
     cellRender: {
       name: 'CellTag',
       props: ({ row }: { row: DictData }) => {
         const tagType = platformMap.get(row.platform)?.tag_type;
         return {
           color: tagType && NAIVE_TAG_TYPE_SET.has(tagType) ? tagType : '',
         };
       },
     },
     ```
   - **「状态」列** (现 `:504-516`): 同 `useTypeColumns` 改造模式。

3. **保留**:
   - `SEARCH_PLATFORM_OPTIONS`、`PLATFORM_OPTIONS`、`NAIVE_TAG_TYPE_SET` 等静态常量。
   - 默认参数兜底: 当 `switchStatusDict` / `platformDict` 未传或为空数组时, 渲染行为退化到与改造前一致 (formatter 写死, cellRender 颜色写死)。
   - `useTypeSearchSchema` / `useDataSearchSchema` 不动 (搜索表单仍走 `SEARCH_PLATFORM_OPTIONS`)。

### Step 4: vue-vben 字典 index.vue 拉取字典并注入

**文件**: `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`

**改动**:

1. **新增 import**:
   ```ts
   import { useListDictData } from '#/api/system/dict/hooks';
   ```

2. **在 setup 顶层 (与现有 `entryTypeCode`/`selectedTypeId` 等 ref 平级) 一次拉两份字典**:
   ```ts
   const { data: dictPage } = useListDictData({
     typeCode: ['sys_switch_status', 'sys_platform'],
   });
   const switchStatusDict = computed<DictData[]>(
     () => (dictPage.value?.items ?? []).filter((d) => d.typeCode === 'sys_switch_status'),
   );
   const platformDict = computed<DictData[]>(
     () => (dictPage.value?.items ?? []).filter((d) => d.typeCode === 'sys_platform'),
   );
   ```

3. **修改 column 实例化** (现 `:90` 与 `:157`):
   ```ts
   const typeColumns: ReturnType<typeof useTypeColumns> = useTypeColumns({ switchStatusDict: switchStatusDict.value });
   const dataColumns: ReturnType<typeof useDataColumns> = useDataColumns({ switchStatusDict: switchStatusDict.value, platformDict: platformDict.value });
   ```
   注: 由于 column 实例化只发生在 setup 顶层, 需要确保 `switchStatusDict.value` 在首次执行时已经可读 (即使为空数组, 兜底分支会接管渲染)。 如果后续字典项更新需要触发列定义重建 (一般不需要, 因为同 platform 下 value→label 映射稳定), 可以 watch + 重置 grid。 本期不引入该复杂度, 接受首次 fetch 之后的字典项变化不重新渲染。

4. **保留**:
   - `useTypeSearchSchema` / `useDataSearchSchema` 不动 (搜索栏仍走 SEARCH_PLATFORM_OPTIONS 兜底)。
   - 抽屉 (`Form`)、批量操作、`fetchDictTypeListApi` / `fetchDictDataListApi` 不动。
   - 不修改 `proxyConfig.ajax.query` 逻辑 (本期仅渲染层调整)。

**验收**:
- `pnpm --filter @vben/web-naive typecheck` 通过
- 浏览器手动验证: VITE_APP_PLATFORM=vue-admin 时, 右表「状态」「归属平台」两列显示与 react-admin 一致 (label 与 color)。

### Step 5: 跨端一致性端到端验证

**命令**:
```bash
# 1. 启动 mock
pnpm --filter @backend-mock-template dev &
sleep 5

# 2. 验证 sys_platform 字典类型就位
curl -s 'http://localhost:3005/api/system/dict-type/all' | jq '.data[] | select(.code=="sys_platform")'
# 期望: 返回 { code: "sys_platform", name: "平台", ... }

# 3. 验证 sys_platform 字典项
curl -s 'http://localhost:3005/api/system/dict-data/list?typeCode=sys_platform&platform=vue-admin&includeGeneral=true' | jq '.data.items | map({value, label, tag_type})'
# 期望: [{value:"general",label:"通用",tag_type:""},{value:"vue-admin",label:"Vue Admin",tag_type:""}]

curl -s 'http://localhost:3005/api/system/dict-data/list?typeCode=sys_platform&platform=react-admin&includeGeneral=true' | jq '.data.items | map({value, label, tag_type})'
# 期望: [{value:"general",label:"通用",tag_type:""},{value:"react-admin",label:"React Admin",tag_type:""}]

curl -s 'http://localhost:3005/api/system/dict-data/list?typeCode=sys_platform&platform=general' | jq '.data.items | map({value, label, tag_type})'
# 期望: [{value:"general",label:"通用",tag_type:""}]

# 4. 启动两端 dev server 浏览器手动验证
pnpm --filter @react-admin dev &
pnpm --filter @vben/web-naive dev &
# 在浏览器分别访问字典管理页面, VITE_APP_PLATFORM 三种模式各看一次
```

**验收**:
- 三种 platform 模式下, react-admin / vue-vben 字典管理页面右表「状态」「归属平台」两列渲染行为一致 (label 字符串与 cellRender 颜色)。

### Step 6 (follow-up): 调用方显式带 includeGeneral=true

**背景**: 用户实测发现 `GET /api/system/dict-data/list?platform=react-admin&typeCode[]=sys_switch_status&typeCode[]=sys_platform` (即不显式带 `includeGeneral`) 在 mock `list.ts:64-69` 默认 `includeGeneral=false`, 结果只返回 react-admin 组的字典项, 缺失 general 组。 用户**确认**: 接口语义保持现状 (默认 `includeGeneral=false`), 由调用方显式带 `includeGeneral=true`。

**改动**:
- `apps/react-admin/src/pages/app/system/dict/index.tsx:526-528`: 把 `useListDictData` 调用加上 `includeGeneral: true`:
  ```ts
  const { data: dictPage } = useListDictData({
    typeCode: ['sys_switch_status', 'sys_platform'],
    includeGeneral: true,
  });
  ```
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue:93-99`: 同样加上 `includeGeneral: true`。

**理由**:
- mock `list.ts:64-69` 的 platform 过滤逻辑: `platform !== 'general' && !includeGeneral` 时只返回当前 platform 组; 加上 `includeGeneral=true` 后返回 `currentPlatform ∪ general`。
- `DictDataQuery.includeGeneral` 字段两端类型已就位 (`apps/react-admin/src/api/rest/types.ts:164`、`apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts:61`), 不需要再拓宽。
- `useListDictData` (react-admin `api/hooks/dict.ts:119-131`、vue-vben `api/system/dict/hooks.ts:139-156`) 都会把 `includeGeneral` 透传到 `queryKey`, 保证缓存按参数区分。

**验收**:
- `pnpm --filter ant-design-pro typecheck` 通过
- `pnpm --filter ant-design-pro lint` 通过
- `pnpm --filter @vben/web-naive typecheck` 通过 (修改文件无新增错误)
- 实测: `curl 'http://localhost:7001/api/system/dict-data/list?platform=react-admin&typeCode[]=sys_switch_status&typeCode[]=sys_platform&includeGeneral=true'` 返回 6 + 2 = 8 条 (sys_switch_status: general+react-admin 4 条 + sys_platform: general+react-admin 2 条)。

## 验证命令

```bash
# 1. 类型检查
pnpm --filter @backend-mock-template typecheck
pnpm --filter @react-admin typecheck
pnpm --filter @vben/web-naive typecheck

# 2. lint
pnpm --filter @backend-mock-template lint
pnpm --filter @react-admin lint
pnpm --filter @vben/web-naive lint
```

## 回滚点

- mock seed 改动失败 → `git checkout -- apps/backend-mock-template/utils/mock-data.ts`
- react-admin 页面改动失败 → `git checkout -- apps/react-admin/src/pages/app/system/dict/index.tsx`
- vue-vben 改动失败 → `git checkout -- apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`

## 提交策略

- 单个 commit: `feat(dict): render status/platform columns from dict label + tag_type`
- 包括:
  - `apps/backend-mock-template/utils/mock-data.ts` (新增 sys_platform 种子)
  - `apps/react-admin/src/api/rest/types.ts` (拓宽 typeCode)
  - `apps/react-admin/src/pages/app/system/dict/index.tsx`
  - `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` (拓宽 typeCode)
  - `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`
  - `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`

## 后续 follow-up

- [ ] 字典 typeId 与前端 valueEnum key 双源不一致问题的根治方案 (本期仅渲染层映射, 数据库字段保持 0/1)。
- [ ] 把 `SEARCH_PLATFORM_OPTIONS` 完全替换为 `sys_platform` 字典 (本期保留作为兜底 + 搜索 initialValue 来源)。
- [ ] column 实例化在 setup 顶层只跑一次, 后续字典项变更不会触发列重建; 后续如需响应式可引入 watch + reload grid。