# 字典管理：新增条目 drawer 布局优化 + 预设样式 tag_type

## Goal

让字典管理页面的「新建条目 / 编辑条目」抽屉布局更清晰、更紧凑，并支持为字典项指定预设的「Tag 样式」（颜色/边框/形状），后端把样式标识保存到 `dict_data.tag_type`，前端列表与回显用统一映射渲染。

## 已确认事实（来自代码/历史任务）

- **DB**：当前 `dict_data` 表（schema.sql 第 315 行）字段：`id / type_id / value / label / sort / is_default / platform / is_enabled / deleted_at / remark / *_at / *_by`，**无 `tag_type`**。
- **后端 mock**（`apps/backend-mock-template/utils/mock-data.ts`）：
  - `DictData` 接口（456-479）无 `tag_type` 字段
  - `ALLOWED_DICT_DATA_PLATFORMS = ["general","react-admin","vue-admin"]`
  - `buildDictDataSeeds()`（591-638）种子无 tag_type
  - CRUD handlers（`index.post.ts`、`[id].put.ts`、`list.ts`）需扩展校验
- **react-admin**：
  - `apps/react-admin/src/api/rest/types.ts` `DictData`、`CreateDictDataRequest`、`UpdateDictDataRequest` 缺 `tag_type`
  - 抽屉：`apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx`，当前是垂直 Form 8 项堆叠
  - 共享：`apps/react-admin/src/pages/app/system/dict/modules/shared.ts`（`getCurrentPlatform / PLATFORM_OPTIONS / SEARCH_PLATFORM_OPTIONS`）
  - 列表渲染：`apps/react-admin/src/pages/app/system/dict/index.tsx` 148 行 `r.platform ? <Tag>{r.platform}</Tag> : ...`
- **vue-vben-admin**（apps/web-naive）：
  - 类型：`apps/web-naive/src/api/system/dict/types.ts` 缺 `tag_type`
  - 抽屉 schema：`apps/web-naive/src/views/system/dict/data.ts` `useDataFormSchema()` 当前 8 项堆叠
  - 抽屉实例：`apps/web-naive/src/views/system/dict/modules/form.vue`
  - 列表列：`useDataColumns()` CellTag（platform/is_default/is_enabled）
- **历史**：相邻任务 `06-27-06-27-dict-data-platform-search*` 已建立 `platform` 字段端到端；本次沿用其「通用 + 自己」模式。
- **运行模式**：react-admin 单仓 + vue-vben-admin 是独立 submodule，需独立提交。

## Requirements

### R1 — DB schema：`dict_data` 加 `tag_type`

- 新字段：`tag_type VARCHAR(32) NOT NULL DEFAULT 'default'` 注释「预设样式标识（default=无样式）;前端按标识映射 ant Tag 颜色 / vben Tag color」
- 默认值 `'default'` 表示「无预设样式」（向下兼容老数据）
- **不加索引**（Q1 已确认：本期不作为筛选字段，最小变动）

### R2 — 后端 mock：扩展 DictData 与 CRUD

- `DictData` interface 加 `tag_type: string`
- `ALLOWED_TAG_TYPES = ['default','primary','success','warning','error','processing','magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple'] as const`（Q3 确认：17 种与 antd Tag preset colors 对齐，外加 default）
- `isAllowedTagType(v)` 守卫函数
- `buildDictDataSeeds()` 不改 tag_type（沿用 default）
- `index.post.ts`：body 允许 `tag_type`；非法值 400；缺省 `'default'`
- `[id].put.ts`：ALLOWED_KEYS 加 `tag_type`；同校验
- `list.ts`：response items 自动带上 `tag_type`

### R3 — react-admin 新建/编辑 drawer 布局优化

**布局思路**：分两块「基础信息 / 样式设置」，通过 Collapse / Tabs / Row 分组，每块独立紧凑。

**布局（参考图意：分组 + 紧凑 + 预览实时）**：
- 顶部：`所属类型 / 字典值 / 字典标签` 三个核心字段一列紧凑
- 中部：「样式设置」区：
  - `开启预设样式` Switch / Checkbox（**默认开**；Q4 确认：编辑时由 row.tag_type !== 'default' 联动）
  - 关闭：只显示 `归属平台 / 是否默认 / 启用 / 备注` 等无样式字段
  - 开启：新增 `预设样式` Select（选项 = ALLOWED_TAG_TYPES 中文映射），右侧实时 `Tag` 预览当前 `label`
- 底部：`排序 / 归属平台 / 是否默认 / 启用 / 备注`

**实时预览规则**：
- 预览组件用 antd `<Tag color={preset.color}>` 渲染；preset 提供 `{ value, label, color, border? }`
- 预览文本默认取 `label` 表单字段；label 为空时显示占位 `示例标签`
- 预览变化：选中样式 / 输入 label 都触发重新渲染

### R4 — vue-vben-admin 新建/编辑 drawer 布局优化（与 R3 对齐）

**布局思路**：同 R3，使用 VbenForm schema 的 `colProps` / `componentProps.slot` 实现分组与预览。

**布局**：
- 默认 schema 调整：`typeId/value/label` 同行或单独分组
- 中部插入 `usePresetStyle` Switch 字段；开启后 schema 动态追加 `tagType` Select + 自定义 `TagPreview` 组件（通过 component: 'Custom' 或插槽）
- 预览组件：用 el-tag 渲染（vben web-naive 用 Element Plus）
- 底部：`sort / platform / isDefault / is_enabled / remark`

### R5 — 列表与回显

- react-admin 列表 platform 列升级：若有 `tag_type !== 'default'`，使用 `<Tag color={...}>` 包装 label / value；否则维持现有渲染
- vue-vben-admin `useDataColumns()` platform 列 `CellTag.props.color` 改为根据 `row.tag_type` 映射；`tag_type === 'default'` 时退化为 default 颜色
- 编辑回显：抽屉打开时把 `row.tag_type` 回填到 `tagType` 字段

### R6 — 兼容性

- 老数据：缺省 `'default'` 不影响渲染（维持当前 Tag 样式）
- 搜索/筛选：**不加** tag_type 到右表搜索栏（Q2 已确认）；保留扩展点
- 跨端：两端 schema 与字段名一致；tag_type 中文 label 一致

## Acceptance Criteria

### A1 — DB / 后端
- [ ] `dict_data` 表加 `tag_type VARCHAR(32) NOT NULL DEFAULT 'default'` + 注释
- [ ] `apps/backend-mock-template/utils/mock-data.ts` DictData 接口加 tag_type；ALLOWED_TAG_TYPES 常量与守卫
- [ ] `index.post.ts` / `[id].put.ts` 校验 tag_type，非法 400
- [ ] `list.ts` 返回 items 包含 tag_type
- [ ] 种子数据不报错；老 mock 重启后默认 default

### A2 — react-admin drawer
- [ ] 新建/编辑抽屉分块（基础信息 / 样式设置），整体高度更紧凑（视觉对比：当前 8 项单列 vs 新版 2 列网格）
- [ ] 「开启预设样式」Switch；默认 true（新建）/ 由 row.tag_type !== 'default' 决定（编辑）
- [ ] 开启后显示「预设样式」Select（中文 label）+ 实时 Tag 预览（颜色与 label 输入联动）
- [ ] 关闭后样式字段隐藏
- [ ] 保存时把 tag_type 提交；编辑回显 row.tag_type

### A3 — vue-vben-admin drawer
- [ ] 新建/编辑抽屉分块，与 react-admin 视觉对位
- [ ] 「开启预设样式」Switch 同 A2
- [ ] 开启后显示「预设样式」Select + 实时 el-tag 预览
- [ ] 表单提交含 tag_type；编辑回显

### A4 — 列表回显
- [ ] react-admin 右表 platform 列：当 `tag_type !== 'default'` 时把 label 用预设 Tag 颜色渲染
- [ ] vue-vben-admin 右表 platform 列：CellTag props.color 按 tag_type 映射；default 退回
- [ ] 两端行为一致

### A5 — 验证
- [ ] 端到端：新建一条 `sys_yes_no = TEST / 测试标签 / tag_type=success`，右表立刻显示绿色 Tag
- [ ] 编辑同一条改 tag_type=warning，列表颜色更新
- [ ] 关闭预设样式后保存，tag_type 落 default，列表回退
- [ ] 提交非法 tag_type（如 'foo'）后端返回 400

## 风险 / 取舍

- **样式预设数量**：过多选项让 Select 难以浏览；候选 16 种颜色已足够，再多应转自定颜色（不在本期）
- **跨端样式一致性**：antd Tag 与 el-tag 的颜色名/视觉不完全一致；统一通过「value + 中文 label」抽象，两端各自映射到自己的色彩 token
- **schema.sql 是单一真源**：本次改动必须与 mock 与两端同步；否则两端运行 OK 但生产 DB 不匹配 → 已记入 implement.md
- **vue-vben-admin 是 submodule**：本次改动要在 submodule 内独立 commit + push，父仓再同步指针

## 已敲定的决策（grill-me 总结）

| # | 决策点 | 结论 |
|---|---|---|
| Q1 | `tag_type` 索引 | **不加**索引 |
| Q2 | `tag_type` 进右表搜索栏 | **不加** |
| Q3 | 预设样式候选集 | **17 种**（与 antd Tag preset colors 对齐） |
| Q4 | 「开启预设样式」默认值 | **默认开**；编辑由 row.tag_type 联动 |

## Notes

- 完成后归档目录：`archive/2026-06/06-28-dict-data-preset-style/`
- 子任务拆分（建议）：
  - `06-28-06-28-dict-data-preset-style-schema` — schema + mock
  - `06-28-06-28-dict-data-preset-style-react-admin` — react-admin drawer + 列
  - `06-28-06-28-dict-data-preset-style-vue-vben-admin` — vue-vben drawer + 列