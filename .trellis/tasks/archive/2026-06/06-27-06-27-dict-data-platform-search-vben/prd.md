# vue-vben-admin 端：右表 platform 搜索筛选 + includeGeneral + 解依赖左表点击

## Goal

`apps/vue-vben-admin/apps/web-naive/src/views/system/dict/`：右表搜索栏 platform 下拉显示 3 项，旁边 includeGeneral checkbox（选 general 时隐藏）。右表初始即加载。

注：此子目录在 git submodule `apps/vue-vben-admin` 中。

## Requirements

### `data.ts`

**新增 `SEARCH_PLATFORM_OPTIONS`（3 项）**：

```ts
export const SEARCH_PLATFORM_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '通用', value: 'general' },
  { label: 'React Admin', value: 'react-admin' },
  { label: 'Vue Admin', value: 'vue-admin' },
];
```

**PLATFORM_OPTIONS 保留 2 项**（给 drawer 表单 Select 用：「通用 + 自己」）。

**`useDataSearchSchema()` 加 platform + includeGeneral**：

```ts
export function useDataSearchSchema(): VbenFormProps['schema'] {
  return [
    {
      component: 'Select',
      fieldName: 'platform',
      label: '归属平台',
      defaultValue: DEFAULT_PLATFORM,
      componentProps: {
        options: SEARCH_PLATFORM_OPTIONS,
        allowClear: true,
        placeholder: '请选择归属平台',
      },
    },
    {
      component: 'Switch',
      fieldName: 'includeGeneral',
      label: '包含通用',
      defaultValue: false,
      // 选 general 时隐藏：用 dependencies 触发 schema 更新
      dependencies: {
        triggerFields: ['platform'],
        ifShow: ({ values }) => values.platform !== 'general',
      },
    },
    { component: 'Input', fieldName: 'value', label: '字典值' },
  ];
}
```

### `index.vue`

**ajax.query 改为拆开 typeCode 与 platform**：

```ts
query: async ({ page }, formValues) => {
  return await fetchDictDataListApi({
    page: page.currentPage,
    pageSize: page.pageSize,
    typeCode: entryTypeCode.value,
    value: formValues.value || undefined,
    platform: formValues.platform || DEFAULT_PLATFORM,
    includeGeneral: formValues.includeGeneral === true,
  });
}
```

**currentRowChange / clearEntrySelection**：保持现状。

### `modules/form.vue`

无改动（表单 Select 仍只二项 PLATFORM_OPTIONS）。

### `locales/langs/{zh-CN,en-US}/system.json`

新增（如未加）：
- `dict.includeGeneral`: 包含通用 / Include general

## Acceptance Criteria

- [ ] 子仓库 pnpm typecheck / lint pass
- [ ] 手动：进入页面右表初始有数据；切换 platform 过滤生效；勾 includeGeneral 出现并集；选 general 时 checkbox 消失
- [ ] 新建抽屉默认 vue-admin