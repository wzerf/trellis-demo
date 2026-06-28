# Implement：字典项预设样式按平台收敛

## 实施策略

按"两端并联改、不动后端、不迁移数据"的原则推进。每端内部遵循：

1. **常量层先行**：先抽出 `PLATFORM_TAG_TYPE_OPTIONS(platform)` 函数，
   把 16 项 vs 6 项的差异收敛到一个入口。
2. **表单层联动**：监听 platform 字段，动态切换下拉选项与开关 disabled。
3. **渲染层兜底**：列表 CellTag 用白名单 set 判定，避免 vue 端再次出现
   "多对一压扁"问题。
4. **提交归一化**：前端永远下发 `tag_type ∈ 16 项`（`usePresetStyle=false` → `'default'`），
   避免后端 PUT 对空串 400。
5. **回归**：表单校验、批量操作、分页不受影响。

## 顺序清单

### 步骤 1：常量层（两端）

- [ ] React Admin `shared.ts`：
  - 新增 `PLATFORM_TAG_TYPE_OPTIONS(platform: string)` 函数。
  - 平台 = `general` 返回 `[]`，否则返回 16 项全集（保持 `TAG_TYPE_OPTIONS` 兼容导出）。
  - 新增 `TAG_TYPE_SET = new Set(TAG_TYPE_OPTIONS.map(o => o.value))`。
- [ ] Vue Admin `data.ts`：
  - 新增 `NAIVE_TAG_TYPE_OPTIONS`（6 项，类型 `TagType`）。
  - 新增 `NAIVE_TAG_TYPE_SET = new Set(...)`。
  - 新增 `PLATFORM_TAG_TYPE_OPTIONS(platform: string)`：platform=general 返回 `[]`，
    否则返回 6 项。
  - 移除 `TAG_TYPE_TO_EL_TYPE` 导出，替换为 `NAIVE_TAG_TYPE_SET`（保留向后兼容
    stub 抛 deprecation warning）。
  - `useDataFormSchema` 中 `tag_type` 字段的 options 改为函数式读取 platform。
  - `useDataColumns` CellTag 颜色改用 `NAIVE_TAG_TYPE_SET` 判定。

### 步骤 2：React Admin 抽屉

- [ ] `dict-data-drawer.tsx`：
  - 增加 `watchedPlatform = Form.useWatch('platform', form)`。
  - 增加 `useEffect`：`watchedPlatform === 'general'` → `form.setFieldsValue({ usePresetStyle: false })`。
  - 「开启预设样式」Switch 上加 `disabled={watchedPlatform === 'general'}`。
  - 「预设样式」Select 的 `options={PLATFORM_TAG_TYPE_OPTIONS(watchedPlatform)}`。
  - `buildFormValues` 中编辑回显：`hasPreset = !!source.tag_type && source.tag_type !== 'default' && TAG_TYPE_SET.has(source.tag_type)`。
  - `handleOk`：`tag_type = usePresetStyle ? (tagType || 'primary') : 'default'`（永远下发白名单内的值，避免后端 400）。

### 步骤 3：Vue Admin 抽屉

- [ ] `form.vue`：
  - `dataModel.platform` 用 `watch`：
    - 切到 `'general'` → `dataModel.usePresetStyle = false`（同时清掉 `tagType='default'`）。
    - 切回自己 → 不强制改 `usePresetStyle`，由用户决定。
  - NSwitch 上加 `:disabled="dataModel.platform === 'general'"`。
  - NSelect 的 `:options` 改用 `PLATFORM_TAG_TYPE_OPTIONS(dataModel.platform)` 的
    computed 结果。
  - `fillDataModelFromRow`：`hasPreset = !!d.tag_type && d.tag_type !== 'default' && NAIVE_TAG_TYPE_SET.has(d.tag_type)`。
  - 提交归一化：`usePresetStyle=false → tag_type='default'`；否则 `tag_type` 不在
    NAIVE_TAG_TYPE_SET 时强制 `'default'`。
  - 预览：`previewElType` 直接传 `dataModel.tagType`（不再走 `TAG_TYPE_TO_EL_TYPE`）。

### 步骤 4：列表渲染校验

- [ ] React Admin `index.tsx`：CellTag 渲染逻辑保持现状（`r.tag_type && r.tag_type !== 'default' ? r.tag_type : undefined`），无需改动。
- [ ] Vue Admin `data.ts` CellTag：`row.tag_type && NAIVE_TAG_TYPE_SET.has(row.tag_type) ? row.tag_type : ''`。

### 步骤 5：质量检查

- [ ] `pnpm --filter react-admin lint / type-check`（vp check 等价命令）。
- [ ] `pnpm --filter vue-vben-admin lint / type-check`。
- [ ] 两端 dev server 启动冒烟：
  - 新建字典项 platform=react-admin → 下拉 16 项；
  - 新建字典项 platform=vue-admin → 下拉 6 项；
  - 切到 platform=general → 开关 disabled 且为关，预览降级纯文本；
  - 编辑历史 `tag_type=magenta` 在 vue 端 → 强制关闭 + 提示文案。

### 步骤 6：归档

- [ ] `task.py archive 06-28-dict-data-preset-style-by-platform`。

## Review 闸门

- 任一步骤完成 → `git diff` 自检 + 让 `trellis-check` 子代理走一遍 type-check / lint。
- 步骤 5 全部通过 → 进入 `task.py archive`。

## 验证命令

```bash
# 类型 + lint（项目用 vite-plus，命令等价）
pnpm --filter react-admin exec tsc --noEmit
pnpm --filter vue-vben-admin exec tsc --noEmit

# Vben 项目（含 web-naive 子 app）
pnpm --filter @vben/web-naive lint
```

（具体命令以各 app `package.json` 的 scripts 为准；运行失败时按 `vp check` 提示调整。）

## 回滚点

- 任一端改动若 lint / type-check / 冒烟失败 → revert 该端 diff，保留另一端。
- 整体不可行 → 整体 revert；后端不动所以无副作用。