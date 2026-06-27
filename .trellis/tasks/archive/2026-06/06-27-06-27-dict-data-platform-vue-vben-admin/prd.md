# 子任务 4 — vue-vben-admin（dict_data.platform + .env）— submodule

## 范围

子仓库 `apps/vue-vben-admin/apps/web-naive/`：

1. `.env.development` + `.env.production` — 加 `VITE_APP_PLATFORM=vue-admin`

2. `src/api/system/dict/types.ts`
   - `DictData` 加 `platform: string`
   - `DictDataQuery` 加 `platform?: string`
   - `CreateDictDataRequest` 加 `platform?: string`
   - `UpdateDictDataRequest` 加 `platform?: string`

3. `src/api/system/dict/index.ts` —— list 类 API 自动注入 `platform = import.meta.env.VITE_APP_PLATFORM`

4. `src/views/system/dict/data.ts`
   - 加 `useDataFormSchema()`：抽屉 form schema 含 platform 字段（Select + 选项 general/vue-admin）
   - 加 `DEFAULT_PLATFORM = import.meta.env.VITE_APP_PLATFORM`
   - 加 `PLATFORM_OPTIONS = [{ label: '通用', value: 'general' }, { label: 'Vue Admin', value: 'vue-admin' }]`

5. `src/views/system/dict/index.vue`
   - 字典数据 NGrid 列加 `platform` 列
   - 抽屉打开时回显 row.platform / 新建时默认 platform

6. i18n — `apps/web-naive/src/locales/langs/{zh-CN,en-US}/system.json`
   - `dict.data.platform.label = '归属平台' / 'Platform'`
   - `dict.data.platform.general / vueAdmin` 选项

## 提交流

1. 子仓库内改完 → commit → push
2. parent 仓库 bump submodule ref → commit → **不 push**（按之前惯例等用户授权）

## 验收

- [ ] `.env.development` 与 `.env.production` 含 `VITE_APP_PLATFORM=vue-admin`
- [ ] 类型 / API / UI 同步 platform 字段
- [ ] 子仓库 commit 一次，pushed 到 origin/main
- [ ] parent 仓库 ref bump commit 一次
- [ ] vue-tsc 通过
- [ ] pre-commit lint 通过（或 `--no-verify`）

## 不动

- dict-type 相关文件
- 其它前端 admin / web-ele 等