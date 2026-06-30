# dict hook 内置 fallback — 执行清单

## 0. 准备

- 拉取最新 master:`git fetch origin && git status`(确保工作区干净)。
- 阅读 PRD (`prd.md`) + design (`design.md`)。
- 确认本地 mock 服务能起:`pnpm -C apps/backend-mock-template dev`(端口 7001)。
- 确认前端能起:`pnpm -C apps/react-admin dev` / `pnpm -C apps/vue-vben-admin dev`。
- 当前任务:`06-30-07-01-dict-hook-fallback-in-hook`,开发分支:`refactor/dict-hook-fallback`。
- 推荐 commit 顺序:**React hook → React UI → Vue hook → Vue UI → spec**。每步独立 typecheck + 视觉回归。

## 1. 实现顺序

### 1.1 React-Admin hook 层

1. **改 `apps/react-admin/src/api/hooks/dict.ts`**
   - 新增导出类型:`NTagPreset`、`DictLookups`、`UseDictLookupsOptions`。
   - 新增常量:`N_TAG_PRESET_SET`(7 项:`default | primary | success | info | warning | error | processing`)。
   - 新增私有常量:`CURRENT_PLATFORM` 已存在,复用。
   - 新增私有常量:`SWITCH_LABEL_FALLBACK`、`SWITCH_TAG_TYPE_FALLBACK`、`IS_ENABLED_KEY_MAP`。
   - 新增函数:`pickPreferred(candidates, platform)` — 平台优先命中。
   - 新增 hook `useDictLookups(options)` — 实现 design.md §2.1-2.4。
   - `useListDictData` 不动。
   - 内部 import `SEARCH_PLATFORM_OPTIONS` 用作 `platformLabels` 默认值(放在 hook 调用方传入)。

2. **自测 hook**
   - `pnpm -C apps/react-admin typecheck` 通过。
   - 单元脑内验证:`lookupSwitchLabel(1)` → `'启用'`(无 dict);`lookupSwitchLabel(0)` → `'禁用'`;`lookupSwitchTagType(1)` → `'success'`(无 dict);`lookupPlatformLabel('general')` → `'general'`(无 dict,且无 platformLabels)。

### 1.2 React-Admin UI 层

3. **改 `apps/react-admin/src/pages/app/system/dict/index.tsx`**
   - 顶部 import:`useDictLookups` 从 `@/api/hooks/dict`。
   - 删除:`SWITCH_STATUS_FALLBACK`、`isEnabledKey`、`buildDictMaps`、`DictDict` 类型。
   - 修改 `buildTypeColumns(switchStatusMap, renderOption)` → `buildTypeColumns(dictLookups, renderOption)`:
     - `statusValueEnum = dictLookups.switchValueEnum`
     - `renderStatus` 用 `dictLookups.lookupSwitchLabel(r.isEnabled)` 和 `dictLookups.lookupSwitchTagType(r.isEnabled)`
   - 修改 `buildDataColumns(platformMap, switchStatusMap, renderOption)` → `buildDataColumns(dictLookups, renderOption)`:
     - 同样 `statusValueEnum = dictLookups.switchValueEnum`
     - `renderStatus` / `renderPlatform` 改用 hook helper
     - `platformValueEnum` 直接用 `dictLookups.platformValueEnum`(dict 页要传入 `platformLabels = { general: '通用', 'react-admin': 'React Admin', 'vue-admin': 'Vue Admin' }` 走 SEARCH_PLATFORM_OPTIONS 的语义)
   - `DictPage` 组件:
     - 删除 `const { data: dictPage } = useListDictData({ typeCode: ['sys_switch_status', 'sys_platform'], includeGeneral: true })`
     - 删除 `const { switchStatusMap, platformMap } = useMemo(() => buildDictMaps(dictPage?.items), [dictPage])`
     - 新增 `const dictLookups = useDictLookups({ platformLabels: SEARCH_PLATFORM_OPTIONS.reduce(...) })`
     - 列定义:`const typeCols = buildTypeColumns(dictLookups, renderTypeActions)` 等。

4. **自测 React**
   - `pnpm -C apps/react-admin typecheck` 通过。
   - `pnpm -C apps/react-admin lint` 通过。
   - 启动 dev,打开字典管理页:
     - 字典正常:状态列显示「启用/禁用」+ Tag 颜色(react-admin 端的 success / 无色)
     - 字典为空(临时注释 mock 服务一行):状态列仍显示「启用/禁用」,无 undefined / 无空白
     - 归属平台列同理
   - 网络面板:仍然只发一次 list 请求(没有额外请求)。

### 1.3 Vue-Vben-Admin hook 层

5. **改 `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts`**
   - 新增导出类型:`NTagPreset`、`DictLookups`、`UseDictLookupsOptions`(用 `MaybeRefOrGetter` 包 options)。
   - 新增常量:`N_TAG_PRESET_SET`(6 项:`default | primary | success | info | warning | error`)。
   - 新增私有常量:`CURRENT_PLATFORM` 已存在,复用。
   - 新增私有常量:`SWITCH_LABEL_FALLBACK`、`SWITCH_TAG_TYPE_FALLBACK`、`IS_ENABLED_KEY_MAP`。
   - 新增函数:`pickPreferred(candidates, platform)`。
   - 新增 hook `useDictLookups(options?)` — 用 `computed` 包所有 helper 与 valueEnum,内部用 `unwrap(options, {})` 一次。
   - `useListDictData` 不动。

6. **自测 Vue hook**
   - `pnpm -C apps/vue-vben-admin typecheck:web-naive`(或对应脚本)通过。

### 1.4 Vue-Vben-Admin UI 层

7. **改 `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue`**
   - 顶部 import:`useDictLookups` from `#/api/system/dict/hooks`。
   - 删除:`isEnabledKey` / `switchTagTypeFor` / `switchLabelFor` / `platformTagTypeFor` / `platformLabelFor` / 4 个 `lookup*` 函数 / `switchStatusDict` / `platformDict` 两个 computed。
   - 新增:`const dictLookups = useDictLookups({ platformLabels: SEARCH_PLATFORM_OPTIONS.reduce(...) })`。
   - 模板插槽改写:
     - `<template #dict_status="{ row }">` 内 `lookupSwitchTagType(row.isEnabled as 0 | 1)` → `dictLookups.lookupSwitchTagType(row.isEnabled as 0 | 1)`,label 同理。
     - `<template #dict_platform="{ row }">` 内 `lookupPlatformTagType(row.platform)` → `dictLookups.lookupPlatformTagType(row.platform)`,label 同理。

8. **自测 Vue**
   - `pnpm -C apps/vue-vben-admin typecheck:web-naive` 通过。
   - 启动 dev,打开字典管理页:
     - 字典正常:状态列 NTag 颜色(text-success / text-default)+ label「启用/禁用」对齐 react-admin
     - 字典为空(临时注释 mock):label 仍为「启用/禁用」,tagType 仍正确(success/default)
     - 归属平台列同理
   - 视觉与改前一致。

### 1.5 Spec

9. **改 `.trellis/spec/frontend/hook-guidelines.md`**
   - 新增段落「数据查询/展示 hook 的 fallback 原则」,含:
     - 原则陈述
     - 正例(hook 自带 fallback)
     - 反例(应用层 `?? '兜底文案'`)
     - valueEnum 兜底约定
     - 新增 fallback 类型时的归位规则
   - 最小代码示例(用 `useDictLookups` 简化版即可,不必贴完整代码)。

## 2. Review 闸门

- **Phase 1.5 → Phase 2**:`task.py review` 看到 prd / design / implement 三份产物。
- **Phase 2 → Phase 3**:每端改完后立即跑 `trellis-check`,直到无 P0/P1 才推进下一个端 / spec。
- **Phase 3.5**:用浏览器实测 acceptance criteria 全清单。

## 3. 验证命令

```bash
# 类型检查
pnpm -C apps/react-admin typecheck
pnpm -C apps/vue-vben-admin typecheck:web-naive   # 如该命令存在

# Lint
pnpm -C apps/react-admin lint

# 端到端
# React-Admin: 打开字典管理页 → 状态列/平台列视觉与改前一致
# Vue: 打开字典管理页 → 同上

# 字典为空验证(临时)
# 在 apps/backend-mock-template/api/system/dict-data/list.ts 临时把 items 置空,
# 重启 mock,确认两个端的状态列/平台列仍正常显示(走 fallback),
# 验证完恢复原代码。
```

## 4. 回滚点

- **回滚 React hook**:revert 对应 commit,React 页面 import 报错但不会运行(若已迁移 UI)。需同时 revert UI commit。
- **回滚 React UI**:revert 对应 commit,React 字典页行为回到「散落 fallback」现状。
- **回滚 Vue hook**:revert 对应 commit,Vue 页面 import 报错但不会运行(若已迁移 UI)。需同时 revert UI commit。
- **回滚 Vue UI**:revert 对应 commit,Vue 字典页行为回到「散落 fallback」现状。
- **回滚 spec**:revert spec commit,无功能影响。
- **全量回滚**:`git revert <merge-commit>` 一把梭。

## 5. 拆分 commit(建议)

```
feat(dict-hook): add useDictLookups in react-admin with built-in fallback
refactor(dict-ui): consume useDictLookups in react-admin dict page; drop scattered fallback
feat(dict-hook): add useDictLookups in vue-vben-admin with built-in fallback
refactor(dict-ui): consume useDictLookups in vue-vben-admin dict page; drop scattered fallback
docs(frontend-spec): add fallback-in-hook convention to hook-guidelines.md
```

每个 commit 自带 typecheck 通过;UI commit 之后附带视觉回归(浏览器手动一次)。

## 6. 关键产物清单(checklist)

- [x] `apps/react-admin/src/api/hooks/dict.ts` 新增 `useDictLookups` + `DictLookups` / `UseDictLookupsOptions` 类型导出
- [x] `apps/react-admin/src/pages/app/system/dict/index.tsx` 移除 `SWITCH_STATUS_FALLBACK` / `isEnabledKey` / `buildDictMaps` / `DictDict`;列定义改用 hook helper
- [x] `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts` 新增 `useDictLookups` + `DictLookups` / `UseDictLookupsOptions` 类型导出
- [x] `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/index.vue` 移除所有 lookup 函数 + computed;模板改用 hook helper(配 NTag 白名单薄适配)
- [x] `.trellis/spec/frontend/hook-guidelines.md` 新增 fallback-in-hook 原则段落(含正反例 + 新增 fallback 的归位流程)
- [x] React `pnpm -C apps/react-admin typecheck && lint` 通过
- [x] Vue `pnpm -C apps/vue-vben-admin typecheck:web-naive` 通过
- [ ] 浏览器实测 React + Vue 字典管理页视觉与改前一致(待用户人工验收)
- [ ] `trellis-check` 通过(待 Phase 3 触发)