# dict_data 重新加回 platform 字段（跨 4 层 + .env 标识）

## 背景

2026-06-27 上午刚把 `dict_type.platform` / `dict_data.platform` 整套清理掉（v7 marker）。`apps/vue-vben-admin` 也跟着清理，子仓库提交 `b49d8e8a0` 已推送。

现在用户确认 `dict_data.platform` 需要重新引入，但**只放在 dict_data 上**（dict_type 仍然保持无 platform）。

语义重定义：
- `dict_data.platform` 表示「这条字典项归属哪个前端平台」—— 用 `general` 表示跨平台通用，用具体平台编码表示只在某个前端 admin 显示。
- 平台编码通过前端 `.env` 的 `VITE_APP_PLATFORM` 注入。
- 列表查询时若前端带了 `VITE_APP_PLATFORM`，则只返回 `platform = 'general'` 或 `platform = <前端自己的 platform>` 的项（前端自己看到自己的；其他平台的项不出现）。

## 目标

1. `backend/db/schema.sql` 的 `dict_data` 表加回 `platform VARCHAR(32) NOT NULL DEFAULT 'general'`，加 `idx_dict_data_platform` 索引，标记 schema v8。
2. mock 全链路（CRUD / list 过滤 / by-type）支持 `platform`，并把当前请求上下文里的 `VITE_APP_PLATFORM` 透传给 list（mock 层通过 query 参数 `?platform=` 接收，前端自动注入）。
3. react-admin / vue-vben-admin：
   - 字典管理 UI：右表加 `平台` 列、抽屉加 platform 字段（带默认值 `general`）。
   - 下拉 / 表单选项：仅 `general` 与前端自己的平台（react-admin → `react-admin`；vue-vben → `vue-admin`）。
   - list 请求：自动从 `import.meta.env.VITE_APP_PLATFORM` 注入 `platform` 参数。
   - `.env.{development,production}` 恢复 `VITE_APP_PLATFORM=<前端>`。

## 范围

- ✅ `backend/db/schema.sql` — dict_data 表加 platform + v8 marker
- ✅ `apps/backend-mock-template` — `DictData` 接口 + seed + list/CRUD/by-type
- ✅ `apps/react-admin` — types.ts / api/rest / dict-data-drawer / shared.ts / 列表列 / i18n / .env
- ✅ `apps/vue-vben-admin/apps/web-naive`（submodule）— types / api / views/system/dict/* / i18n / .env
- ❌ 不动 `dict_type` 表（保持 v7 状态：无 platform）
- ❌ 不动 `dict_type` 的 mock / 前端字段

## 平台枚举

```
general       — 跨前端共用
react-admin   — react-admin 端专属
vue-admin     — vue-vben-admin（web-naive）端专属
```

约束：
- 必须是这 3 个之一（mock 校验，错误 400）
- 长度 ≤ 32
- 默认 `general`

## 验收

- [ ] schema.sql dict_data 有 platform 列、NOT NULL、DEFAULT 'general'、有索引，Section 10 注释 v8 marker
- [ ] mock list 接口支持 `?platform=` 单值过滤（精确）；不带参数时返回全部
- [ ] mock POST/PUT 校验 platform ∈ {general, react-admin, vue-admin}，错误返回 400
- [ ] react-admin 启动后：右表能看到「平台」列；新建字典项默认 platform=general；新建字典类型下拉里的 platform 字段值来自前端 `.env`
- [ ] react-admin .env.development 里有 `VITE_APP_PLATFORM=react-admin`、production 同名
- [ ] vue-vben-admin 同上，`.env.development` 里有 `VITE_APP_PLATFORM=vue-admin`
- [ ] 子仓库 commit + push 一次，parent 仓库 ref bump 一次（two commit 流）
- [ ] tsc / vue-tsc 通过；pre-commit hook 通过（或 `--no-verify` 兜底）

## 风险

- mock 层 `platform` 过滤对未带参数场景的兼容性 —— 旧调用没传 `platform` 应该返回全部，与现有数据无破坏
- 前端 `.env` 之前被删，恢复时要确保不影响其它已用 `VITE_*` 的脚本
- 子仓库之前的 `b49d8e8a0` 删 platform 这次是反向操作，子仓库历史会出现「加 → 删 → 加」；这是用户主动选择，不算冲突，但 commit message 要清晰说明