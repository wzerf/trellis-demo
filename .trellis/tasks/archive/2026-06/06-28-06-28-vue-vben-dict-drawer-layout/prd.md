# vue-vben 字典项 drawer 布局重构（对齐 react 分组）

## Goal

把 vue-vben-admin `apps/web-naive` 的「字典项」新建/编辑抽屉从「无分组单列堆叠」（图2）改造为「分组 + 两列紧凑」布局，**对齐 react-admin 版**（图1）的三段 Card 视觉。

## 已确认事实

- **现状**：vue-vben `apps/web-naive/src/views/system/dict/modules/form.vue` + `data.ts useDataFormSchema()`：
  - `wrapperClass: 'grid-cols-1'`（默认单列堆叠）
  - schema 字段 9 个，无视觉分组
  - 预览块 NTag 在 Drawer 模板尾部、Form 之外独立渲染
- **react-admin 参照**（图1）：
  - 三段 `<Card size="small" title="...">`：基础信息 / 样式设置 / 其他属性
  - 字段横向两列（Row + Col span 12 / 24）：字典值+字典标签、排序+归属平台、是否默认+启用
  - 样式设置段：开启预设样式（8列）+ 预设样式 Select（10列）+ 预览（6列）
  - 备注 span 24
- **vben form 限制**：
  - 单个 Form 实例按 wrapperClass 网格渲染所有 schema 字段
  - Form 模板内不能插入 NCard 标题分隔（vben Form 自动渲染 schema 列表）
  - 多个 Form 实例的 formApi **不能共享**（无 store 复用 API）

## 选定方案：单 Form + NCard 包外层 + grid-cols-2 + 分组视觉分隔

### 核心思路
vben Form 的 schema 字段是**连续顺序渲染**，无法在 Form 内部插入 NCard 标题分隔。因此采用：
- **外层** `<NCard title="...">` 整个包住 Form + 预览
- **Form 内部**通过 `formItemClass: 'col-span-2' | 'col-span-1'` + `wrapperClass: 'grid-cols-2'` 实现两列布局
- **分组视觉分隔**：在 schema 中每个分组前添加一个**纯展示型字段**（如 `component: 'Divider'` 或 `component: 'Text'` + label 作为小标题），靠 `formItemClass: 'col-span-2'` 横跨整行

### 字段分组与排版

```
[NCard 外层：标题「新建/编辑字典项」]

  [Form: wrapperClass=grid-cols-2 gap-x-16px gap-y-0]

    基础信息（h2 标题跨满两列）
      所属类型                col-span-2
      字典值 | 字典标签       col-span-1 each

    样式设置（h2 标题跨满两列）
      开启预设样式 | 预设样式 | 预览       col-span 6/12/6 (3 列)

    其他属性（h2 标题跨满两列）
      排序 | 归属平台          col-span-1 each
      是否默认 | 启用          col-span-1 each
      备注                    col-span-2

[预览块放在样式设置行的右侧，不在 Drawer 尾部]
```

### 预览实现变化
**当前**：Drawer 模板底部独立 `<NTag>` 预览块（依赖 formApi.form.values）
**新方案**：通过 schema 添加一个**纯展示字段** `fieldName: 'tagPreview'` + `component: 'Text'` + `formItemClass: 'col-span-6'`，值通过 formApi.form.values 响应式生成 text。`Text` 组件只显示不提交。

但 schema 默认 `useVbenForm` 会让 `Text` 组件被注册吗？最稳的做法是**保持原 Drawer 尾部预览块**，但把 NCard 视觉分组与两列布局做出来。预览位置保持不变（Drawer 底部），Form 渲染区仍是两列分组。

**简化决策**：预览块仍放在 Drawer 底部，不迁移进 Form 内部。本次重构只做：
1. NCard 外层包 Form（替代无 NCard 平铺）
2. wrapperClass 改为 grid-cols-2
3. schema 中字段顺序调整 + formItemClass 跨列（实现两列 + 备注跨满）
4. 添加「分组小标题」字段（component: 'Text'）跨满两列实现视觉分隔

## Requirements

### R1 — 外层 NCard
- template 用 NCard 包整个 Form，标题与 drawer 标题一致（「新建字典项」/「编辑字典项」）
- NCard size small / 内边距合理

### R2 — Form 两列网格
- `wrapperClass: 'grid-cols-2'`（大屏两列）+ `commonConfig.componentProps.class: 'w-full'`
- schema 字段顺序：所属类型 (span 2) → 字典值 (span 1) → 字典标签 (span 1) → ... → 备注 (span 2)

### R3 — 分组小标题
- 三个分组小标题（基础信息 / 样式设置 / 其他属性）作为 schema 字段插入：
  - `component: 'Text'` (或 'Divider' 看可用性)
  - `fieldName: '_section_basic' / '_section_style' / '_section_other'`
  - `formItemClass: 'col-span-2'` 跨满两列
  - 视觉上像 h4 小标题（粗体 + 上下间距）
- 提交时这些字段会被 formApi.getValues 收集为 `_section_*` 键，需在 onConfirm 里删除（或用 `filterFields: false` + 手动拣选）

### R4 — 保留响应式预览
- 预览 NTag 块仍在 Drawer 模板底部（Form 之外）
- 通过 `formApi.form.values` 响应式联动 label / tag_type / usePresetStyle
- 当 usePresetStyle=false 时显示「（开启预设样式后展示颜色）」

### R5 — 兼容性
- 不破坏 onConfirm 提交流（getValues 后过滤掉 _section_* 字段）
- 编辑回显逻辑不变
- 字典类型（kind='type'）schema 不动（kind !== 'data' 不重排）

## Acceptance Criteria

### A1 — 视觉对齐
- [ ] vue-vben 抽屉：外层 NCard 包 Form，整体卡片化
- [ ] 内部字段两列网格布局（桌面端）；小屏自动堆叠（wrapperClass md:grid-cols-2）
- [ ] 三段分组小标题明显（基础信息 / 样式设置 / 其他属性）
- [ ] 字典值 + 字典标签同行；排序 + 归属平台同行；是否默认 + 启用同行；备注独占
- [ ] 预览 NTag 块仍响应式联动 label / tag_type / usePresetStyle

### A2 — 行为对齐
- [ ] 新建字典项：默认 usePresetStyle=true, tag_type='primary', platform=DEFAULT_PLATFORM
- [ ] 编辑字典项：usePresetStyle 由 row.tag_type 联动；tag_type 回填
- [ ] usePresetStyle=false → 提交时 tag_type 强制为 'default'
- [ ] typecheck 通过
- [ ] 提交时 payload 不含 _section_* 字段

## 风险

- **schema Text/Divider 组件可用性**：vben form 的 components 注册表是否含 Text/Divider？需先确认；若无可降级为「分组小标题」字段用 `component: 'Input'` + `componentProps.disabled: true` + 自定义 render（schema 不支持 render）或放弃小标题，改为相邻 schema 项加 `formItemClass: 'col-span-2 mb-0'` 用 `help` 或 label 模拟
- **getValues 包含 _section_***：提交前手动 delete 这两个 key
- **大字段跨列**：`formItemClass` 仅影响单字段样式，分组小标题跨满需单独设置

## 不做
- 不抽公共包、不改 react-admin
- 不重写 formApi 共享方案（复杂度高、本期不值）

## 涉及文件
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`：`useDataFormSchema()` 调整 + wrapperClass 调整
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue`：模板外层 NCard + onConfirm 过滤 _section_*