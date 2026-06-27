# mock 端：dict-data list 支持 includeGeneral OR 过滤

## Goal

`apps/backend-mock-template/api/system/dict-data/list.ts` 新增 `?includeGeneral=1` 参数，使前端能查「react-admin ∪ general」并集。其他字段无改动。

## Requirements

### 入参

- `platform`（已有）：`general` / `react-admin` / `vue-admin`，缺省 = 'general'
- `includeGeneral`（新增）：boolean，缺省 = false

### 过滤逻辑

```ts
if (platform !== 'general' && includeGeneral === true) {
  filtered = filtered.filter((x) => x.platform === platform || x.platform === 'general');
} else if (platform !== 'general') {
  filtered = filtered.filter((x) => x.platform === platform);
}
// platform === 'general' → 不过滤 platform
```

### `includeGeneral` 解析

兼容 boolean 和字符串：

```ts
const includeGeneral =
  String(getQuery(event).includeGeneral ?? '') === '1' ||
  String(getQuery(event).includeGeneral ?? '') === 'true';
```

## Acceptance Criteria

- [ ] `?platform=react-admin` → 仅 react-admin
- [ ] `?platform=react-admin&includeGeneral=1` → react-admin + general 并集
- [ ] `?platform=vue-admin&includeGeneral=1` → vue-admin + general 并集
- [ ] `?platform=general` → 仅 general（includeGeneral 参数被忽略）
- [ ] `?includeGeneral=1`（无 platform）→ 仅 general（platform 缺省 + includeGeneral=true → 等价于查 general）
- [ ] 单元行为不破坏 typeCode/value/status 已有过滤