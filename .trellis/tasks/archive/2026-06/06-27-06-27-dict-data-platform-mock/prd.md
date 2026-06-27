# 子任务 2 — mock CRUD + seed（dict_data.platform）

## 范围

`apps/backend-mock-template/`：

1. `utils/mock-data.ts`
   - `DictData` 接口加 `platform: string`
   - `buildDictDataSeeds` 的 `seed(...)` 工厂加 `platform = 'general'` 默认
   - 现有 14 条 seed 数据不动（默认就是 general）

2. `api/system/dict-data/`
   - `list.ts`：支持 `?platform=<single>` 精确匹配过滤；不带参数 → 返回全部；join typeCode 后保留 platform 字段
   - `index.post.ts`：body 类型加 `platform?: string`，校验 ∈ {general, react-admin, vue-admin}，写入新行
   - `[id].put.ts`：ALLOWED_KEYS 加 `platform`，校验同上
   - `by-type/[code].ts`：保持现状（按 code 过滤，不动 platform 语义）；返回字段保留 platform

## 平台枚举与校验

```ts
const ALLOWED_PLATFORMS = ['general', 'react-admin', 'vue-admin'] as const;
type Platform = typeof ALLOWED_PLATFORMS[number];
```

## 验收

- [ ] `DictData` 接口含 `platform: string`
- [ ] POST 不带 platform 时写入 `'general'`
- [ ] POST 带 platform=`<非法值>` 时返回 400
- [ ] PUT 修改 platform 生效
- [ ] list 带 `?platform=react-admin` 只返回 platform=react-admin 的行
- [ ] list 不带 platform 参数时返回全部
- [ ] by-type 接口返回的项含 platform 字段

## 不动

- dict-type/* 任何接口
- `dict_type.platform` —— 本次不引入