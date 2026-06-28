# 字典管理：新增条目 drawer 布局优化 + 预设样式 tag_type — 设计

> 范围：DB schema + 后端 mock + react-admin + vue-vben-admin 四端同步。
> 本文档只写设计与契约，不写执行清单（清单在 implement.md）。

---

## 1. 边界与模块拆分

| 层 | 模块 | 责任 |
|---|---|---|
| DB | `backend/db/schema.sql` | `dict_data` 加 `tag_type` 字段 |
| Mock | `apps/backend-mock-template/utils/mock-data.ts` + `api/system/dict-data/*` | 类型扩展 + CRUD 校验 + list 输出 |
| react-admin | `src/api/rest/types.ts` + `pages/app/system/dict/modules/{shared.ts, dict-data-drawer.tsx}` + `index.tsx` | 类型 + 抽屉布局 + 列表回显 |
| vue-vben-admin (submodule) | `apps/web-naive/src/api/system/dict/types.ts` + `views/system/dict/{data.ts, modules/form.vue}` + `views/system/dict/index.vue` | 类型 + 抽屉 schema + 列表 CellTag 映射 |

**子任务**（一个父任务 + 三个独立子任务）：
1. `06-28-06-28-dict-data-preset-style-schema` — schema + mock
2. `06-28-06-28-dict-data-preset-style-react-admin` — react-admin drawer + 列
3. `06-28-06-28-dict-data-preset-style-vue-vben-admin` — vue-vben drawer + 列（submodule 单独提交）

## 2. 数据契约

### 2.1 DB 字段

```sql
-- Section 10: dict_data 增加 tag_type
ALTER TABLE dict_data
  ADD COLUMN tag_type VARCHAR(32) NOT NULL DEFAULT 'default'
    COMMENT '预设样式标识(default=无样式;前端按标识映射 ant Tag 颜色 / vben Tag color)'
  AFTER platform;
```

注释规则沿用 v8（NULL 策略），且因为 `NOT NULL DEFAULT 'default'`，老数据天然兼容。

### 2.2 后端 mock

```ts
// utils/mock-data.ts
export interface DictData {
  id: number;
  type_id: number;
  value: string;
  label: string;
  sort: number;
  is_default: 0 | 1;
  platform: string;
  tag_type: string;          // 新增
  is_enabled: 0 | 1;
  deleted_at: number;
  remark: string;
  /* ...timestamps / soft references... */
  typeCode?: string;
}

export const ALLOWED_TAG_TYPES = [
  'default','primary','success','warning','error','processing',
  'magenta','red','volcano','orange','gold','lime','green',
  'cyan','blue','geekblue','purple',
] as const;

export type TagType = (typeof ALLOWED_TAG_TYPES)[number];

export function isAllowedTagType(v: unknown): v is TagType {
  return typeof v === 'string' && (ALLOWED_TAG_TYPES as readonly string[]).includes(v);
}
```

**CRUD 校验**（与 platform 校验对称）：
- POST `index.post.ts`：body 加 `tag_type?: string`；非法 400；缺省 `'default'`
- PUT `[id].put.ts`：`ALLOWED_KEYS` 加 `'tag_type'`；非法 400
- GET `list.ts`：items 已通过 `getMockDictDataList()` 返回，自然带 `tag_type`（注意 list handler 当前若对 items 做过滤/裁剪要保留字段）

### 2.3 前端类型

```ts
// react-admin src/api/rest/types.ts 与 vue-vben apps/web-naive/src/api/system/dict/types.ts
export interface DictData {
  /* ...existing... */
  platform: string;
  tag_type: string;   // 新增
  /* ... */
}

export interface CreateDictDataRequest {
  /* ...existing... */
  platform?: string;
  tag_type?: string;  // 新增
}

export interface UpdateDictDataRequest {
  /* ...existing... */
  platform?: string;
  tag_type?: string;  // 新增
}
```

### 2.4 样式映射（共享概念，两端各自映射到自己的组件色板）

```ts
// react-admin / shared.ts 与 vue-vben / data.ts 各自一份
export const TAG_TYPE_OPTIONS: Array<{ value: TagType; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'primary', label: '主要' },
  { value: 'success', label: '成功' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '危险' },
  { value: 'processing', label: '进行中' },
  { value: 'magenta', label: '洋红' },
  { value: 'red', label: '红色' },
  { value: 'volcano', label: '火山' },
  { value: 'orange', label: '橙色' },
  { value: 'gold', label: '金色' },
  { value: 'lime', label: '青柠' },
  { value: 'green', label: '绿色' },
  { value: 'cyan', label: '青色' },
  { value: 'blue', label: '蓝色' },
  { value: 'geekblue', label: '极客蓝' },
  { value: 'purple', label: '紫色' },
];

// 列表回显：tag_type='default' → 不染色（保留默认行为）
// react-admin：<Tag color={row.tag_type}>{row.platform}</Tag>，color='default' 视觉 = 无染色
// vue-vben CellTag：color 字段用 row.tag_type；CellTag props.color='default' 在 el-tag 里就是无色
```

## 3. UI 数据流

### 3.1 react-admin 抽屉（dict-data-drawer.tsx）

状态机：

```
[open]
  ├── isEdit=true
  │     ├── usePresetStyle = row.tag_type !== 'default'    // 自动回显
  │     └── tagTypeSelect = row.tag_type ?? 'primary'
  └── isEdit=false
        ├── usePresetStyle = true                            // Q4 默认开
        └── tagTypeSelect = 'primary'                        // 默认选择

[usePresetStyle 切换]
  ├── true  → 显示 tagType Select + TagPreview
  └── false → 隐藏，提交时 tag_type 强制为 'default'
```

预览组件：

```tsx
const TagPreview = ({ color, text }: { color: string; text?: string }) => (
  <Tag color={color} style={{ marginLeft: 8 }}>
    {text || '示例标签'}
  </Tag>
);
```

预览联动用 `Form.useWatch(['label','tagType'], form)` 读取最新值。

### 3.2 vue-vben-admin 抽屉（form.vue + data.ts）

schema 设计：

```ts
// data.ts: useDataFormSchema()
{
  component: 'Switch',
  fieldName: 'usePresetStyle',
  label: '开启预设样式',
  defaultValue: true,
  dependencies: {
    triggerFields: ['usePresetStyle', 'tag_type'],
    show: (vals) => !!vals.usePresetStyle,    // 联动隐藏 tag_type 行
  },
},
{
  component: 'Select',
  fieldName: 'tag_type',
  label: '预设样式',
  defaultValue: 'primary',
  // 通过 controlClass / 自定义 slot 注入 TagPreview
  dependencies: {
    triggerFields: ['usePresetStyle'],
    show: (vals) => !!vals.usePresetStyle,
  },
},
```

预览实现两条路（实现时择一）：
- **A. 通过 form slot 注入**：schema 加 `slot: 'tagPreview'`，form.vue 模板 `<template #tagPreview>` 渲染 el-tag
- **B. 通过 component: 'TagPreview' 自定义组件**：注册全局自定义组件（首选 A，更轻量）

提交处理：

```ts
const values = {
  ...rawValues,
  isDefault: !!rawValues.isDefault,
  is_enabled: rawValues.is_enabled ? 1 : 0,
  tag_type: rawValues.usePresetStyle ? (rawValues.tag_type ?? 'primary') : 'default',
};
```

## 4. 列表回显

### 4.1 react-admin

当前 `index.tsx:148`：

```tsx
r.platform ? <Tag>{r.platform}</Tag> : <span style={{ color: '#999' }}>-</span>
```

升级：

```tsx
const PlatformTag = ({ platform, tagType }: { platform: string; tagType?: string }) => {
  if (!platform) return <span style={{ color: '#999' }}>-</span>;
  if (!tagType || tagType === 'default') return <Tag>{platform}</Tag>;
  return <Tag color={tagType}>{platform}</Tag>;
};
```

### 4.2 vue-vben-admin

`data.ts` `useDataColumns()`：

```ts
cellRender: {
  name: 'CellTag',
  props: ({ row }) => ({ color: row.tag_type || 'default' }),
},
field: 'platform',
```

注意：原来用 `row.platform === 'general' ? 'default' : 'info'` 区分；现在统一让 tag_type 决定。兼容性：老数据 tag_type='default' → 视觉与之前「general」列等同（无染色）。

## 5. 兼容性 & 迁移

- **老数据**：缺省 `'default'`，列表回退到无染色 Tag，行为不变
- **schema.sql**：单一真源。本次只新增 `ADD COLUMN`，向后兼容；不需要重写现有索引
- **mock 重启**：内存列表重置 → tag_type 全为 `default`，无报错
- **跨端契约**：tag_type 字符串值与中文 label 一致；schema 与 types 同步修改

## 6. 权衡

| 取舍 | 选择 | 理由 |
|---|---|---|
| 索引 | 不加 | 本期无筛选场景，最小变动 |
| 搜索栏 | 不加 | 避免范围爆炸；后期按需添加 |
| 候选集 | 17 种 | 与 antd Tag preset colors 对齐；两端都能映射 |
| 默认开启 | 默认开 | 提升样式认知度；用户关闭仍可保存 default |
| 预览组件 | 端内本地 | 不抽公共包，react 与 vue-vben 各自实现 |

## 7. 上线 / 回滚

- **回滚点**：schema 变更（DDL），可单独 `ALTER TABLE dict_data DROP COLUMN tag_type` 回滚
- **前端回滚**：保留 git revert 即可
- **mock 回滚**：revert 对应 handlers + types

## 8. 与历史任务的对齐

- 与 `06-27-06-27-dict-data-platform-search*` 共用 platform 字段模式；tag_type 字段语义对称
- 不改 `platform` 字段行为；不破坏 includeGeneral 等现有逻辑