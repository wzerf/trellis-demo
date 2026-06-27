# 字典管理 platform 搜索筛选 + 右表初始加载

## Goal

字典管理右表（字典数据）改造三处：
1. 搜索栏 platform 下拉显示 3 项（`general` / `react-admin` / `vue-admin`），旁边加「包含通用」checkbox。
2. 右表不再依赖左表点击就有数据；初始即按默认 platform 加载。
3. 新建默认 platform = 当前前端 .env 标识（`VITE_APP_PLATFORM`），编辑可三选（但只能选「通用 + 自己」二选一；后端校验阻断对方平台）。

覆盖两端：`apps/react-admin` + `apps/vue-vben-admin/apps/web-naive`。

## Requirements

### Platform 下拉筛选

**下拉框显示三项**（不是只有「通用 + 自己」）：
- `general`（通用）
- `react-admin`
- `vue-admin`

**旁边的「包含通用」checkbox**（语义：把通用结果并进来）：
- checkbox 只在选择 **非 general** 时出现
- 选择 `general` 时 checkbox 隐藏（因为只查通用没必要再并一次）
- 默认 unchecked
- 勾上 → 查询结果 = 「当前 platform + general」并集（OR）
- 不勾 → 只查当前 platform（自己）

### 后端契约

`GET /api/system/dict-data/list` 新增支持：

- `?platform=react-admin` — 单值 exact match（已有）
- `?platform=react-admin&includeGeneral=1` — react-admin ∪ general
- `?platform=general` — 仅 general
- `?platform=` 缺失 → 沿用前端 DEFAULT_PLATFORM

实现：mock handler 解析 `includeGeneral` 布尔；若为 true 且 `platform !== 'general'`，将 `general` 加入过滤集合。

### 新建 / 编辑

| 模式 | platform 表单值 | 选项 |
|---|---|---|
| 新建 | 默认 `VITE_APP_PLATFORM` | 通用 + 自己（二选一） |
| 编辑 | 回显 `row.platform` | 通用 + 自己（二选一） |

**关键：表单 Select 不让选对方平台**（与下拉搜索区分：搜索下拉三项；表单 Select 二项）。

### 初始加载（解依赖左表点击）

- react-admin：进入页面，右表初始即按 DEFAULT_PLATFORM 加载；不点左表也有数据。
- vue-vben-admin：当前只有点左表才加载，本次修复同上。

`typeCode` 仍由左表点击行 / 关闭按钮控制；初始为空（不传）。

## Acceptance Criteria

### 1. 搜索筛选

- [ ] 右表搜索栏出现 `platform` Select（显示 3 项）
- [ ] 右侧（或同一行）出现 `includeGeneral` checkbox
- [ ] 选中 `react-admin` / `vue-admin` 时 checkbox 显示
- [ ] 选中 `general` 时 checkbox 隐藏
- [ ] 默认 unchecked
- [ ] 勾上 + 选 react-admin → 查询 `?platform=react-admin&includeGeneral=1`，响应包含 react-admin + general 项
- [ ] 不勾 + 选 react-admin → 查询 `?platform=react-admin`，响应只含 react-admin
- [ ] 选 general → 查询 `?platform=general`
- [ ] 两端行为一致

### 2. 右表初始加载

- [ ] react-admin: 进入页面，未点左表，右表显示「全 type × DEFAULT_PLATFORM」字典项
- [ ] vue-vben-admin: 同上
- [ ] 点左表某行 → 右表额外按 `typeCode` 过滤；关闭 Tag → 取消 `typeCode`，platform 筛选保留

### 3. 新建 / 编辑

- [ ] react-admin 新建抽屉：platform Select 默认值 = `react-admin`（来自 .env），选项仅「通用 + react-admin」
- [ ] vue-vben-admin 新建抽屉：platform Select 默认值 = `vue-admin`（来自 .env），选项仅「通用 + vue-admin」
- [ ] 编辑抽屉：platform Select 回显该行 platform，选项同上
- [ ] 后端 POST/PUT 校验阻断对方 platform

## 涉及文件

### 后端 mock
- `apps/backend-mock-template/api/system/dict-data/list.ts` — 解析 `includeGeneral`，过滤集合并
- `apps/backend-mock-template/utils/mock-data.ts` — 无改动（已支持 platform 字段）

### react-admin
- `src/pages/app/system/dict/modules/shared.ts` — 已有 PLATFORM_OPTIONS；新增 `getIncludeDefault()` 等辅助
- `src/pages/app/system/dict/index.tsx` — 右表搜索栏加 platform Select + includeGeneral Checkbox；ajax query 带 platform + includeGeneral
- `src/pages/app/system/dict/modules/dict-data-drawer.tsx` — 确认 platform 默认值/回显
- `src/api/hooks/dict.ts` — query type 加 includeGeneral
- `src/api/rest/types.ts` — `DictDataQuery` 加 includeGeneral?: boolean

### vue-vben-admin（apps/web-naive）
- `src/views/system/dict/data.ts` — `useDataSearchSchema()` 加 platform + includeGeneral；PLATFORM_OPTIONS 改为 3 项
- `src/views/system/dict/index.vue` — ajax query 拆开 typeCode 与 platform；初始即 reload
- `src/views/system/dict/modules/form.vue` — 平台 Select 仍只二项（与搜索区分）
- `src/api/system/dict/types.ts` — query type 加 includeGeneral

## 风险

- **搜索 vs 表单 Select 项数不同**：搜索 3 项（含对方），表单 2 项（不含对方）。用户已明确区分。
- **includeGeneral 仅前端用**：本前端可能不会传该字段给「对方」前端；mock 已支持即可。
- **子仓库单独提 PR**：vue-vben-admin 是 submodule，需独立 commit + push。

## 开发策略

- Dev mode: current-session
- Branch: master（与上次一致）
- TDD: 否
- Worktree: 否
- 架构审查：disabled
- 子仓库共享路径：N/A（不开 subagent worktree）

## Review gates

```
Review-gate contract: explicit-selection-v1
Optional review gates status: configured
Enabled optional review gates: trellis-code-review
Disabled optional review gates: trellis-spec-review, trellis-code-architecture-review, trellis-improve-codebase-architecture, trellis-merge-review
trellis-check: required (fixed)
```

## 启动顺序

1. mock（list.ts 加 includeGeneral 过滤）
2. react-admin（right table search schema + ajax + types）
3. vue-vben-admin（search schema + ajax + submodule 提 PR）
4. parent 仓库汇总 commit