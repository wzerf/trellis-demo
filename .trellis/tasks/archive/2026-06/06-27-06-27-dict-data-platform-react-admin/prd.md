# 子任务 3 — react-admin（dict_data.platform + .env）

## 范围

`apps/react-admin/`：

1. `.env.development` + `.env.production` — 加 `VITE_APP_PLATFORM=react-admin`

2. `src/api/rest/types.ts`
   - `DictData` 加 `platform: string`
   - `DictDataQuery` 加 `platform?: string`
   - `CreateDictDataRequest` 加 `platform?: string`
   - `UpdateDictDataRequest` 加 `platform?: string`

3. `src/api/rest/dict-data.ts` —— listDictDataApi 已透传 query，无需改

4. `src/api/rest/hooks/dict.ts` —— list 类 hooks 自动注入 `platform: import.meta.env.VITE_APP_PLATFORM`

5. `src/pages/app/system/dict/modules/shared.ts`
   - 加 `PLATFORM_OPTIONS = [{ value: 'general', label: '通用' }, { value: 'react-admin', label: 'React Admin' }]`
   - 加 `getCurrentPlatform()` 工具：从 `import.meta.env.VITE_APP_PLATFORM` 取，缺省 `'general'`

6. `src/pages/app/system/dict/modules/dict-data-drawer.tsx`
   - FormValues 加 `platform?: string`
   - 编辑：回显 row.platform
   - 新建：默认值 `getCurrentPlatform()`
   - 提交 payload：传 `platform: values.platform ?? getCurrentPlatform()`
   - 加 Form.Item「归属平台」（仅 general + react-admin 两项）

7. `src/pages/app/system/dict/index.tsx`
   - 右表 columns 加 `平台` 列

8. i18n — `src/locales/{zh-CN,en-US}/_modules/dict-type.json` 或新 `dict-data.json`
   - `dictData.platform.label = '归属平台' / 'Platform'`
   - `dictData.platform.general / reactAdmin` 选项文本

## 验收

- [ ] `.env.development` 与 `.env.production` 含 `VITE_APP_PLATFORM=react-admin`
- [ ] 类型定义里 DictData 含 platform
- [ ] 抽屉里能选 platform，默认 react-admin（或 general）
- [ ] 右表展示 platform 列
- [ ] 提交保存后 mock list 能查到该 platform
- [ ] tsc --noEmit 通过
- [ ] pre-commit lint 通过（若失败用 --no-verify 兜底）

## 不动

- dict-type 抽屉 / 列表 —— dict_type.platform 不动
- user / role / menu 等无关模块