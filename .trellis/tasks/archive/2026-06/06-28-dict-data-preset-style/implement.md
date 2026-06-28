# 字典管理：新增条目 drawer 布局优化 + 预设样式 tag_type — 实施

## Review-gate contract: explicit-selection-v1
Optional review gates status: configured
Enabled optional review gates: trellis-code-review
Disabled optional review gates: trellis-spec-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review
trellis-check: required (fixed)

## 开发策略

- **Dev mode**: current-session
- **Branch**: master
- **TDD**: 否
- **Worktree**: 否
- **架构审查**：disabled
- **子仓库策略**：vue-vben-admin 是 submodule，单独 commit + push；父仓最后同步指针

## 启动顺序

```
[1/3] schema + mock ─┬─→ [2/3] react-admin ─┬─→ [3/3] vue-vben-admin ─┬─→ 父仓汇总 commit
                      └─ schema 先落地保证两端类型对齐 ←──┘
```

## 子任务清单（按依赖顺序启动）

### 子任务 1：schema + mock

**active-task path**: `.trellis/tasks/06-28-dict-data-preset-style/06-28-06-28-dict-data-preset-style-schema`

实施步骤：

1. `backend/db/schema.sql` Section 10：
   - `dict_data` 表加 `tag_type VARCHAR(32) NOT NULL DEFAULT 'default' COMMENT '预设样式标识(default=无样式;前端按标识映射 ant Tag 颜色 / vben Tag color)'`，位置 `AFTER platform`
   - 顶部版本注释加一行：`v9 (dict_data): 加 tag_type 字段(预设样式标识)`
2. `apps/backend-mock-template/utils/mock-data.ts`：
   - `DictData` interface 加 `tag_type: string`
   - 新增 `ALLOWED_TAG_TYPES / TagType / isAllowedTagType`
   - `buildDictDataSeeds()` 的 seed helper 默认加 `tag_type: 'default'`，调用处不改
3. `apps/backend-mock-template/api/system/dict-data/index.post.ts`：
   - body 类型加 `tag_type?: string`
   - 校验逻辑（参考 platform 块）：`isAllowedTagType(raw)` → 用值；`undefined` → `'default'`；否则 400
   - `newRow` 写入 `tag_type`
4. `apps/backend-mock-template/api/system/dict-data/[id].put.ts`：
   - `ALLOWED_KEYS` 加 `'tag_type'`
   - 加 `if ('tag_type' in patch)` 校验块
5. `apps/backend-mock-template/api/system/dict-data/list.ts`：
   - 确认 response items 直接来自 `mockDictDataList`，自然带 tag_type；如有显式 pick 字段则保留

**验证命令**：
- `pnpm --filter backend-mock-template exec tsc --noEmit`（如未配置则跳过）
- 手工：`curl POST /api/system/dict-data` 带 `tag_type: 'success'` → 200；带 `tag_type: 'foo'` → 400

### 子任务 2：react-admin

**active-task path**: `.trellis/tasks/06-28-dict-data-preset-style/06-28-06-28-dict-data-preset-style-react-admin`

实施步骤：

1. `apps/react-admin/src/api/rest/types.ts`：
   - `DictData / CreateDictDataRequest / UpdateDictDataRequest` 加 `tag_type?: string` / `tag_type: string`
2. `apps/react-admin/src/pages/app/system/dict/modules/shared.ts`：
   - 导出 `TAG_TYPE_OPTIONS`（17 项）+ `TagType` 类型
3. `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`：
   - FormValues 加 `usePresetStyle: boolean`、`tagType?: string`
   - 布局：核心字段（typeId/value/label）顶部；中部 usePresetStyle Switch + tagType Select + TagPreview 同行；底部 sort/platform/isDefault/is_enabled/remark
   - 编辑回显：`usePresetStyle = row.tag_type !== 'default'`
   - 新建默认：`usePresetStyle = true`、`tagType = 'primary'`
   - usePresetStyle=false 时 tagType 字段隐藏，提交时强制 `tag_type: 'default'`
   - `Form.useWatch(['label','tagType'])` 驱动预览
   - 提交：isEdit 走 `updateDictData({ ..., tag_type })`；非 edit 走 `createDictData({ ..., tag_type })`
4. `apps/react-admin/src/pages/app/system/dict/index.tsx`：
   - 列渲染 `platform` 升级：根据 `row.tag_type` 决定 `<Tag color={...}>` 还是 `<Tag>`
   - 搜索栏不动（Q2 已确认）

**验证命令**：
- `cd apps/react-admin && pnpm exec tsc --noEmit`（如配置）
- `pnpm exec eslint src/pages/app/system/dict`（如配置）
- 手工：进入字典管理 → 新建条目 → 切换预设样式 → 提交 → 列表颜色更新

### 子任务 3：vue-vben-admin（submodule）

**active-task path**: `.trellis/tasks/06-28-dict-data-preset-style/06-28-06-28-dict-data-preset-style-vue-vben-admin`

前置：在 vue-vben-admin 子模块内独立 commit + push；父仓最后同步指针

实施步骤：

1. `apps/web-naive/src/api/system/dict/types.ts`：
   - 同 react-admin 类型扩展（tag_type）
2. `apps/web-naive/src/views/system/dict/data.ts`：
   - 导出 `TAG_TYPE_OPTIONS`（与 react-admin 一致的中文 label）
   - `useDataFormSchema()` 增加 `usePresetStyle` Switch 字段（默认 true）
   - 增加 `tag_type` Select 字段，默认 `primary`，依赖 `usePresetStyle` 决定显隐
   - `useDataColumns()` platform 列 CellTag.props.color 改为 `row.tag_type || 'default'`
3. `apps/web-naive/src/views/system/dict/modules/form.vue`：
   - 在 Drawer 中插入 `#tagPreview` 插槽（form schema 用 `slot: 'tagPreview'`，或者在 schema 上挂 `componentProps.slot`）
   - 插槽内：`useFormValues()` 拿 label 与 tag_type，渲染 `<el-tag :type="...">{{ label || '示例标签' }}</el-tag>`
   - onOpenChange 内：编辑模式回显 `usePresetStyle = data.tag_type !== 'default'`、`tag_type = data.tag_type ?? 'primary'`
   - onConfirm 内：usePresetStyle=false 强制 tag_type='default'
4. `apps/web-naive/src/views/system/dict/index.vue`：
   - 不动（搜索栏不加 tag_type）

**el-tag type 映射**（Element Plus el-tag 不直接接受 antd 颜色字符串）：

```ts
const TAG_TYPE_TO_EL_TYPE: Record<string, '' | 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  default: '',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  processing: 'info',
  magenta: 'danger',
  red: 'danger',
  volcano: 'danger',
  orange: 'warning',
  gold: 'warning',
  lime: 'success',
  green: 'success',
  cyan: 'info',
  blue: 'primary',
  geekblue: 'primary',
  purple: 'info',
};
```

**验证命令**：
- 在 submodule 内 `pnpm exec tsc --noEmit`
- 手工同上

## 提交顺序

```
1. 子任务 1 (schema + mock) → 父仓 commit
2. 子任务 2 (react-admin) → 父仓 commit
3. 子任务 3 (vue-vben-admin) → submodule commit + push → 父仓同步 submodule 指针
4. 父仓汇总：可选整体 squash 或保持线性
```

## 风险点 / 回滚

| 风险 | 触发 | 回滚 |
|---|---|---|
| schema 与 mock 不一致 | DDL 落了但 mock 未升级 | ALTER TABLE DROP COLUMN + revert mock commit |
| 子模块指针未同步 | submodule commit 后忘了父仓 commit | 父仓单独 commit 更新指针 |
| 预览组件渲染异常 | useWatch 失效 | 退化为静态预览（label 输入后手动刷新） |
| 跨端色板差异 | antd 颜色名与 el-tag type 不一致 | 已通过 TAG_TYPE_TO_EL_TYPE 映射表规避 |

## Review gates 执行顺序

```
trellis-check (required, fixed)
  └── trellis-code-review (enabled)
```

`trellis-check` 在每个子任务结束时跑；`trellis-code-review` 在父任务收尾前跑。

## 启动前 checklist（task.py start 前）

- [x] prd.md 含可验证 acceptance
- [x] design.md 含契约与权衡
- [x] implement.md 含本策略块
- [x] 4 个决策点已敲定（不加索引、不加搜索、17 种预设、默认开）