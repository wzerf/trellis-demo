# React 端：右表 platform 搜索筛选 + includeGeneral + 解依赖左表点击

## Goal

仅 `apps/react-admin/src/pages/app/system/dict/`：右表搜索栏 platform 下拉显示 3 项（含对方平台），旁边加 includeGeneral checkbox（选 general 时隐藏）。右表初始即加载。

## Requirements

### `modules/shared.ts`

```ts
// 已有：PLATFORM_OPTIONS（仅 通用 + 自己）—— 给 drawer Select 用

// 新增：搜索下拉用 3 项（含对方平台）
export const SEARCH_PLATFORM_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: 'React Admin', value: 'react-admin' },
  { label: 'Vue Admin', value: 'vue-admin' },
] as const;
```

### `index.tsx`

**search schema 加 platform + includeGeneral**：

```ts
{
  title: '归属平台',
  dataIndex: 'platform',
  valueType: 'select',
  valueEnum: { general: '通用', 'react-admin': 'React Admin', 'vue-admin': 'Vue Admin' },
  fieldProps: { allowClear: true, placeholder: '请选择归属平台' },
},
{
  title: '包含通用',
  dataIndex: 'includeGeneral',
  valueType: 'checkbox',
  hideInSearch: false,
  // 选 general 时隐藏：antd ProTable 不支持字段级 hideInSearch 条件
  // 用 renderFormItem 自定义：当 formValues.platform === 'general' 时不渲染
  renderFormItem: (_, { type, defaultRender, formItemProps, fieldProps, ...rest }, form) => {
    const current = form.getFieldValue('platform');
    if (current === 'general') return null;
    return defaultRender(rest);
  },
  initialValue: false,
}
```

**ajax request**：

```ts
request: async (params, sort, filter) => {
  const platform = (params.platform as string) || CURRENT_PLATFORM;
  const includeGeneral = params.includeGeneral === true || params.includeGeneral === 'true';
  return fetchListDictEntries({
    ...params,
    platform,
    includeGeneral,
    typeCode: undefined,
  });
}
```

### `modules/dict-data-drawer.tsx`

无改动（已是「通用 + 自己」二项）。

### `api/hooks/dict.ts` + `api/rest/types.ts`

`DictDataQuery` 加 `includeGeneral?: boolean`；`useListDictData` 透传。

### `locales/{zh-CN,en-US}/_modules/dict-entry.json`

新增：
- `includeGeneral`: 包含通用 / Include general
- `includeGeneralTip`: 同时返回通用平台的字典项

## Acceptance Criteria

- [ ] pnpm typecheck / lint pass
- [ ] 手动：进入页面右表初始有数据；切换 platform 过滤生效；勾 includeGeneral 出现 react-admin + general 并集；选 general 时 checkbox 消失；点左表某行 typeCode 生效
- [ ] 新建抽屉默认 react-admin