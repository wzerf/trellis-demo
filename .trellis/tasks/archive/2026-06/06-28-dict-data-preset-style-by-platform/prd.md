# PRD：字典项预设样式按平台收敛

## 背景与现状

字典项（`DictData`）编辑抽屉有「开启预设样式」开关 + 「预设样式」下拉，
下拉候选 `TAG_TYPE_OPTIONS` 在两端硬编码为同一份 16 项列表：

- 状态色（antd `PresetStatusColorType` + Naive UI `NTag type` 重叠支持）：
  `default / primary / success / warning / error / processing`
- 颜色预设（antd `PresetColorType` 独占，Naive UI `NTag type` **不支持**）：
  `magenta / red / volcano / orange / gold / lime / green / cyan / blue / geekblue / purple`

Vue 端为了让所有 16 项都能渲染，把它们强行归类到 Naive UI 的 6 个 type 上
（`TAG_TYPE_TO_EL_TYPE`），结果是 `magenta / red / volcano` 三个在 vue 列表里都
渲染成红色，`lime / green` 都渲染成 success 色，`blue / geekblue` 都渲染成 primary——
视觉上和 react-admin 完全不一致，即用户反馈的「vue 很多都一样」。

后端 `ALLOWED_TAG_TYPES`（mock）保留 16 项作为存储真源（不动），意味着历史数据中
可能存在 vue 端 UI 不再支持的 legacy 颜色预设（如 `magenta`）—— 这次任务不清理存储，
只在 UI 层降级处理。

## 目标

1. Vue 端下拉收敛到 Naive UI `NTag type` 原生支持的 6 项，与 react-admin 状态色完全对齐，
   不再依赖 `TAG_TYPE_TO_EL_TYPE` 的多对一压扁。
2. 「归属平台」= `general`（通用）时，预设样式字段强制关闭 + disabled，提交时
   `tag_type` 存 `'default'`（写库为 `default`，列表按纯 label 文本渲染）。
3. 编辑历史数据遇到 vue UI 不识别的 `tag_type`（如 `magenta`、`processing` 等）时，
   统一降级为「开启预设样式 = false」，列表侧用纯文本渲染。

## 非目标

- 不改后端 mock 的 `ALLOWED_TAG_TYPES`、不改 `tag_type` 字段类型、不改任何 schema。
- 不做数据迁移（不批量改写存量字典项的 `tag_type`）。
- 不动「归属平台」字段本身的联动逻辑（已有搜索区与表单的 `general / 自己` 选项保持原状）。

## 行为契约

| 场景 | React Admin (antd Tag) | Vue Admin (Naive UI NTag) |
|------|-----------------------|---------------------------|
| 下拉候选（platform = 自己） | `default / primary / success / processing / error / warning / magenta / red / volcano / orange / gold / lime / green / cyan / blue / geekblue / purple`（16 项，与后端白名单一致） | `default / primary / info / success / warning / error`（6 项，Naive UI NTag type 原生支持） |
| platform = general | 开关 `disabled` + `checked=false`，预览降级为纯文本；提交 `tag_type='default'` | 同左（NSwitch disabled + false，preview 为文本 `<span>`） |
| platform = 自己 + 编辑历史 `tag_type` 不在 vue 白名单（如 `magenta`） | n/a（antd Tag 全支持） | 视为「开启预设样式 = false」（不报错），列表侧用纯 label 渲染 |
| 列表 CellTag | `row.tag_type && row.tag_type !== 'default'` 时上 antd 原生 Tag；否则纯文本 | `row.tag_type` ∈ Naive UI 6 项时上 NTag；否则纯文本（同样降级） |

### 字段约束

- 关闭预设样式（`usePresetStyle=false`）时，提交 `tag_type='default'`（永远下发白名单内的值，
  避免后端 PUT 对空串 400；后端白名单 16 项 ⊃ 前端白名单）。
- `usePresetStyle=true` 时 `tag_type` 必须从当前平台可见集合里选；提交时若
  值不在该集合里，前端把它强制归一化为 `'default'`，不报 400。

### 视觉

- 「开启预设样式」开关在 platform=general 时颜色不变但点击无响应；
  鼠标悬停提示由 Form.Item 的 label 解释即可，不另加 Tooltip 组件。
- 预览区域在 platform=general / usePresetStyle=false 时显示纯文本
  `<span>{label || "示例标签"}</span>`，灰字、字号与 NTag / Tag 视觉对齐。
- Vue 端编辑历史不支持的 `tag_type` 时，预览旁显示一行小字：
  「原样式在此平台不支持，已自动关闭」。

## 验收标准

### 功能验收

- [ ] Vue 端「预设样式」下拉候选稳定为 6 项：
  `默认 / 主要 / 信息 / 成功 / 警告 / 危险`。
- [ ] Vue 端删除 `TAG_TYPE_TO_EL_TYPE` 映射表，所有 NTag 使用原生 type 直传，
  列表与预览的视觉与下拉语义一一对应。
- [ ] React Admin 端下拉候选保持 16 项不变，但 platform=general 时开关 disabled。
- [ ] 两端 platform=general 提交后，后端拿到的 `tag_type` 是 `'default'`。
- [ ] 两端 platform=自己，编辑历史 `tag_type=magenta` 时（仅 Vue 端命中此分支），
  UI 显示「开启预设样式」开关为关、tag_type 下拉为空/未选、预览降级纯文本 +
  「原样式在此平台不支持」提示；保存后保持关闭状态。
- [ ] 列表渲染：
  - react-admin：antd Tag 颜色 = 原始 `tag_type`（除 `default` / 空 → 纯文本）。
  - vue-admin：仅当 `tag_type ∈ {default, primary, info, success, warning, error}` 时
    用 NTag，其余一律纯文本。

### 回归验收

- [ ] 两端字段必填校验仍生效（字典值、字典标签、所属类型、归属平台）。
- [ ] 两端「批量启用/禁用/删除」与列表分页不受影响。
- [ ] 后端 `ALLOWED_TAG_TYPES` 与 `isAllowedTagType` 校验不动；前端对
  非自身白名单值的归一化在前端表单层完成，不依赖后端配合。

## 影响面

- `apps/react-admin/src/pages/app/system/dict/modules/shared.ts`
- `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`
- `apps/react-admin/src/pages/app/system/dict/index.tsx`（仅 CellTag 防御性微调，可选）
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue`

## 风险

- 「平台=自己」下，编辑历史 `tag_type=magenta` 时强制关掉预设样式：
  保存后会丢颜色信息；用户可能没意识到这点 → 通过预览区提示「已关闭：原样式
  在此平台不支持」告知。
- 跨平台可见集合不一致意味着「react-admin 看到 16 色 / vue-admin 看到 6 色」
  永远存在；如果未来要让 vue 也支持 10 个颜色预设，需单独任务，不在本次范围。