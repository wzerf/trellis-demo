# Design：字典项预设样式按平台收敛

## 1. 边界

**改造范围**（纯前端 + UI 适配层）：

- React Admin：抽屉、列表共享常量、ProColumns 渲染。
- Vue Vben Admin（web-naive）：抽屉 reactive model、schema、列表 CellTag。
- 不触碰：后端 mock、API 类型、字段存储。

**对外契约**（不破坏现有 API）：

- 后端 `POST/PUT /system/dict-data` 仍接受 `tag_type` ∈ 16 项；
  前端在 platform=自己 时下发给后端的 `tag_type` 仍落在这 16 项里（前端白名单
  ⊂ 后端白名单）；platform=general 时下发 `""` —— 后端现状接受空字符串
  （POST handler 见到未传/空时回退 `default`，参见 `index.post.ts:76-78`）。
  本任务需确认 `""` 在 PUT 路径里也能被接受：PUT 当前 `isAllowedTagType("")`
  会返回 `false`，所以这里前端下发空串时会被后端 400。**这是隐藏风险**，见 §6。

## 2. 数据契约（前端 ↔ 后端）

| 来源 | `tag_type` 取值 | 后端是否接受 |
|------|----------------|--------------|
| 新建 / 编辑，platform=自己 + 下拉选中项 | `default / primary / success / warning / error / processing`（react-admin 还会带 10 个颜色预设） | 是 |
| 新建 / 编辑，platform=general，前端不传 `tag_type` | （POST 走空，handler 默认 `default`） | 是 |
| 新建 / 编辑，platform=general，前端传 `tag_type=''` | PUT 当前 **会 400** | 否 |

> 关键：当前后端 PUT 路径在 `isAllowedTagType(patch.tag_type)` 上会拒绝空串。
> 因此 platform=general 时，前端**不能**下发 `tag_type: ""`，必须直接不下发
> 这字段（或下发 `undefined`），让 PUT 跳过该字段的更新。设计选择：前端表单
> 提交时 `tag_type` 在 `usePresetStyle=false` 场景下从 body 里删掉，让后端
> 保留原值不变 —— 但这又跟「通用平台强制关闭预设样式」的语义冲突。
> 决定：在前端层把列表 CellTag 的「无染色 = 空 / 'default'」统一为 `default`，
> 提交时仍下发 `'default'`。即：
> - 「关闭预设样式」存到后端的语义就是 `tag_type='default'`，列表按空渲染。
> - 不下发空串，不触发后端 400。
> - 这与 mock 后端 `POST handler` 已有逻辑一致（未传就回退 `default`）。

## 3. 前端状态/渲染契约

### React Admin 端

常量分层：

```
PLATFORM_TAG_TYPE_OPTIONS: (platform) => TagType[]
  // platform = 'general' → 返回 []（开关 disabled 后无需选项）
  // platform = 自己 → 返回 16 项全集（与后端白名单对齐）

TAG_TYPE_OPTIONS: 保留导出，固定 16 项（向后兼容）
```

`dict-data-drawer.tsx`：

- 增加 `watchedPlatform = Form.useWatch('platform', form)`。
- 联动规则：
  - `watchedPlatform === 'general'`：把 `usePresetStyle` 强制设 `false`（用
    `form.setFieldsValue`），Switch `disabled`。
  - `watchedPlatform !== 'general'`：开关可用。
- `tagType` 下拉的 `options` = `PLATFORM_TAG_TYPE_OPTIONS(watchedPlatform)`。
- 编辑回显兼容：若 `row.tag_type` 不在 16 项里（极少见，但防御性写一下），
  `usePresetStyle=false`。
- 提交时 `tag_type`：
  - `usePresetStyle=false` → `'default'`
  - `usePresetStyle=true` → `tagType || 'primary'`

`index.tsx` 列表 CellTag：

- `r.tag_type && r.tag_type !== 'default' ? r.tag_type : undefined`（现状已对，
  保持不动；与新契约一致）。

### Vue Admin 端

常量分层：

```
NAIVE_TAG_TYPE_OPTIONS: 6 项
  // default | primary | info | success | warning | error

PLATFORM_TAG_TYPE_OPTIONS: (platform) => TagType[]
  // platform = 'general' → []
  // platform = 自己 → NAIVE_TAG_TYPE_OPTIONS

// 替代原 TAG_TYPE_TO_EL_TYPE，做成一个集合判断：
NAIVE_TAG_TYPE_SET: Set<string>（来自 NAIVE_TAG_TYPE_OPTIONS）
```

`form.vue` 三段卡片的「样式设置」段：

- `dataModel.platform` 用 `watch` 监听：
  - 切到 `'general'`：`dataModel.usePresetStyle = false`，UI 上 NSwitch `disabled`。
  - 切回自己：`dataModel.usePresetStyle = true`（保留用户之前的选择；若新建默认是 true）。
- 编辑回显 `fillDataModelFromRow`：
  - `hasPreset = !!d.tag_type && d.tag_type !== 'default' && NAIVE_TAG_TYPE_SET.has(d.tag_type)`
  - legacy 颜色预设（`magenta`、`processing` 等）→ `hasPreset=false`，UI 立刻
    提示「已关闭：原样式在此平台不支持」（占位文案："原样式在此平台不支持，
    已自动关闭预设样式"）。

`data.ts` 表单 schema：

- `tag_type` 字段的 `componentProps.options` 改成一个返回函数
  `() => PLATFORM_TAG_TYPE_OPTIONS(values.platform)`（vben form schema
  支持 componentProps 接受函数）；或保留静态 options，由 form.vue 用 `setFieldValue`
  在 platform 变化时强制把 `tag_type` 重置成 `'default'`（当选项不在新白名单时）。
  采用前者更直接。

`data.ts` 列表 CellTag：

- `color: row.tag_type && NAIVE_TAG_TYPE_SET.has(row.tag_type) ? row.tag_type : ''`
- 注意 Naive UI CellTag 接受 type 字符串；'default' 在 vue vben CellTag 上表现
  为无染色（与项目里 CellTag 现状一致）。

## 4. 兼容性 / 回退形态

- **保持向后兼容**：所有 16 项 `tag_type` 写库仍合法；前端只是不展示。
- **不删除 `TAG_TYPE_OPTIONS`**：旧导出保留，注 deprecation comment，
  下个迭代再删（避免一次性破坏外部调用方）。
- **不删除 `TAG_TYPE_TO_EL_TYPE`**：因为替换为「白名单判断」语义更准，
  决定本次直接移除导出，并在原位置留 JSDoc 指向 `NAIVE_TAG_TYPE_SET`。

## 5. 上线 / 回滚

- 纯前端改动，feature branch 上直接合 master。
- 回滚：revert PR 即可；后端 / DB 没有任何 schema 变更。
- 没有数据迁移；存量历史项的展示会自然降级为「在 vue 端显示纯文本」，
  这是本次明确接受的 UX 妥协。

## 6. 已识别风险与决策

| 风险 | 决策 |
|------|------|
| PUT 后端拒绝空串 `""` | 前端永远下发 `'default'`（语义：关闭 = `default`） |
| legacy 颜色预设编辑后视觉丢失 | 通过 UI 提示「已自动关闭」告知用户，**不自动迁移** |
| Vue CellTag 的 `color=""` 是否真为「无色」 | 用 `'default'` 字符串代替空串，验证 vben CellTag 接受 |
| 跨端选项数量不同（16 vs 6） | PRD 已记录「这是预期」，本次不解决 |

## 7. 改动文件清单

- `apps/react-admin/src/pages/app/system/dict/modules/shared.ts`
- `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`
- `apps/react-admin/src/pages/app/system/dict/index.tsx`（仅 CellTag 防御性微调）
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts`
- `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue`