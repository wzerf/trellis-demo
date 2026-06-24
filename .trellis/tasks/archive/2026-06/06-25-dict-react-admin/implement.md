# 字典管理 react-admin — 执行计划

## 策略

- 沿用 user 模块的 4 层结构：`api/rest/{resource}.ts` → `api/hooks/{resource}.ts` → `pages/app/system/{resource}/` → `router/modules/system.tsx`。
- 把现有 stub（`api/hooks/dict.ts` 抛错版本与 `hooks/useDictCache.ts`）升级为真实实现，不再抛错。
- i18n 在已有 `dict-type.json` / `dict-entry.json` 上合并扩充，不破坏 key。
- 跑通端到端：CRUD + drawer + 双表选中 + 错误提示。

## 顺序

1. **类型与 REST**
   - `src/api/rest/types.ts` 追加 DictType / DictData / *Query / *Request
   - `src/api/rest/dict-type.ts`
   - `src/api/rest/dict-data.ts`
   - `src/api/rest/index.ts` re-export

2. **React Query Hooks**
   - 覆盖 `src/api/hooks/dict.ts`（删 stub 注释，写 11 个 hook）
   - `src/api/hooks/index.ts` re-export

3. **useDictCache 兼容**
   - `src/hooks/useDictCache.ts` 删除 stub 注释，保留 fetchAllDictEntries 为 no-op + resetDictCache 等函数签名；getDictEntriesOptionsByTypeCode 改为真实 fetch（异步）。

4. **页面**
   - `src/pages/app/system/dict/index.tsx`
   - `src/pages/app/system/dict/modules/dict-type-drawer.tsx`
   - `src/pages/app/system/dict/modules/dict-data-drawer.tsx`
   - `src/pages/app/system/dict/modules/shared.ts`

5. **路由**
   - `src/router/modules/system.tsx` 加 dict 子路由

6. **i18n**
   - 扩 `zh-CN/_modules/dict-type.json`、`zh-CN/_modules/dict-entry.json`、`en-US/_modules/dict-type.json`、`en-US/_modules/dict-entry.json`
   - 扩 `zh-CN/_core/routes.json`、`en-US/_core/routes.json`

7. **本地验证**
   - mock：`pnpm --filter backend-mock-template dev`（端口 4000）
   - 前端：`pnpm --filter react-admin dev`
   - 登录 → 系统管理 / 字典管理 → 双表 CRUD 全部走通
   - console 无 error

## 闸门

- `pnpm --filter react-admin typecheck` 通过（若工程未配该 script，则 `pnpm --filter react-admin build`）。
- 浏览器实测 CRUD 全流程通过；启用开关同步；选中行高亮；删除有数据的类型时弹出错误提示。
- 替换后 `grep -R "已废弃" apps/react-admin/src/api/hooks apps/react-admin/src/hooks/useDictCache` 不再命中 dict 相关。

## 风险与回滚

- 修改 `src/api/hooks/dict.ts` 会让旧调用方不再抛错；若有第三方依赖 stub 抛错行为，需保持同样签名。
- 路由注册 dict 后侧栏会自动出现；如不需要默认显示，可在 meta.hidden=true 临时屏蔽。
- i18n key 合并时若已存在同名 key（文案不同）需保留 react-admin 现有文案优先（locale 文件由它拥有）。

## 完成判据

- 侧栏出现「字典管理」入口，点击进入可见左右两表。
- 双表 + drawer 交互节奏与 Open Design 原型一致（顶部过滤栏 + 主表 + 行内操作 + 抽屉表单）。
- 不改动其它模块；只新增 / 局部替换。