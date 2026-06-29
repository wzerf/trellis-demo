# 字典管理接口全端驼峰 — 技术设计

## 1. 边界与契约

### 1.1 mock-data 内部存储

保持 snake 不变（`type_id / is_default / tag_type / is_enabled / deleted_at / created_at / updated_at / created_by / updated_by`），
所有 handler 在「入口 / 出口」做一次大小写转换。理由：

- 种子数据已有 5+ 处 snake 字段，统一改容易引入额外回归。
- handler 转换只发生在 `readBody` 后与 `useResponseSuccess` 前，影响面可控。
- 未来若 mock-data 迁到 ORM/DB，仍可以保留 snake（与 DB schema 习惯对齐），转换只发生在 API 层。

### 1.2 Handler 边界转换

每个 handler 文件头部新增两个工具（私有，不导出）：

```ts
// apps/backend-mock-template/utils/dict-camel.ts
const TO_CAMEL: Record<string, string> = {
  type_id: 'typeId',
  is_default: 'isDefault',
  tag_type: 'tagType',
  is_enabled: 'isEnabled',
  deleted_at: 'deletedAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  created_by: 'createdBy',
  updated_by: 'updatedBy',
};
const TO_SNAKE: Record<string, string> = Object.fromEntries(
  Object.entries(TO_CAMEL).map(([k, v]) => [v, k]),
);

export function pickCamelKeys<T extends Record<string, unknown>>(
  raw: Record<string, unknown>,
  allowed: readonly string[],
): Partial<T> {
  // 接受 camel 也接受 snake：优先 camel，否则回退 snake。
  const out: Record<string, unknown> = {};
  for (const camel of allowed) {
    if (camel in raw) { out[camel] = raw[camel]; continue; }
    const snake = TO_SNAKE[camel];
    if (snake && snake in raw) out[camel] = raw[snake];
  }
  return out as Partial<T>;
}

export function toCamelRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[TO_CAMEL[k] ?? k] = v;
  }
  return out;
}
```

`ALLOWED_KEYS` / 类型断言全部改 camelCase，但允许 snake 输入（迁移期容错）。
错误信息统一用 camelCase 字段名（与新契约一致）。

### 1.3 类型层契约

- React-Admin：`DictType / DictData / CreateDictTypeRequest / UpdateDictTypeRequest / CreateDictDataRequest / UpdateDictDataRequest / DictTypeQuery / DictDataQuery` 字段全部 camelCase。
- Vue-Vben-Admin：同上（`apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts`）。
- 两端的 `DictTypeQuery.status` 字段保持 `0 | 1`（与 query string 的 `status=` 对齐）。

## 2. Handler 改造清单

### 2.1 dict-data

- `index.post.ts`：`body` 类型 camelCase；用 `pickCamelKeys` 取值；`isDefault` boolean 转 0/1；
  返回 `toCamelRow(newRow)`。
- `[id].put.ts`：`ALLOWED_KEYS` 改为 `['value','label','sort','isDefault','platform','tagType','isEnabled','remark']`；
  patch 字段全部 camel；返回 `toCamelRow(...)`；每个校验块读 `patch.isDefault / patch.tagType / patch.isEnabled`。
- `[id].delete.ts`：返回 `toCamelRow(...)`。
- `batch.post.ts`：返回结构 `{action, affected, ids}` 不变。
- `list.ts`：items 走 `toCamelRow`；查询参数 key 不变（`typeCode / status / platform / includeGeneral` 已经是 camel）。
- `by-type/[code].ts`：items 走 `toCamelRow`。

### 2.2 dict-type

- `index.post.ts`：body camel；返回 `toCamelRow(...)`。
- `[id].put.ts`：`ALLOWED_KEYS` 改为 `['code','name','remark','isEnabled']`；返回 `toCamelRow(...)`。
- `[id].delete.ts`：返回 `toCamelRow(...)`。
- `[id].ts`：返回 `toCamelRow(...)`。
- `list.ts` / `all.ts`：items 走 `toCamelRow`。
- `batch.post.ts`：返回 `{action, affected, ids}` 不变。

### 2.3 错误信息规范

所有 400 错误信息提到 camelCase 字段名（`isEnabled must be 0 or 1`），便于前端直接对照类型契约排查。

## 3. 前端改造清单

### 3.1 React-Admin

| 文件 | 改动 |
| --- | --- |
| `apps/react-admin/src/api/rest/types.ts` | `DictType/DictData/Create*/Update*` 全部 snake→camel |
| `apps/react-admin/src/api/rest/dict-type.ts` | 无逻辑改动（仅依赖 types） |
| `apps/react-admin/src/api/rest/dict-data.ts` | 无逻辑改动 |
| `apps/react-admin/src/api/hooks/dict.ts` | 无逻辑改动 |
| `apps/react-admin/src/pages/app/system/dict/modules/dict-data-drawer.tsx` | 删除 `tag_type` 转换；`is_default/is_enabled` 改名；表单 `name="is_enabled"` → `name="isEnabled"`；编辑回显改读 camelCase |
| `apps/react-admin/src/pages/app/system/dict/modules/dict-type-drawer.tsx` | 表单字段名 `is_enabled` → `isEnabled`；提交 payload 同步改 |
| `apps/react-admin/src/pages/app/system/dict/index.tsx` | `DictDict.tag_type → tagType`；`buildDictMaps` 改读 `d.tagType`；列 render 读 `r.isDefault / r.isEnabled` |

### 3.2 Vue-Vben-Admin（web-naive）

| 文件 | 改动 |
| --- | --- |
| `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/types.ts` | 类型全 camelCase |
| `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/index.ts` | 无逻辑改动 |
| `apps/vue-vben-admin/apps/web-naive/src/api/system/dict/hooks.ts` | 无逻辑改动 |
| `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/data.ts` | schema 字段 `tag_type → tagType`、`is_enabled → isEnabled`；表格列 `field: 'is_enabled' → 'isEnabled'`、`field: 'is_default' → 'isDefault'`、`field: 'updated_at' → 'updatedAt'`、`field: 'typeCode'` 不变、`field: 'tag_type' → 'tagType'` |
| `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form.vue` | 编辑回显 `d.tag_type / d.is_default / d.is_enabled` → camel；提交 payload 同步改 |
| `apps/vue-vben-admin/apps/web-naive/src/views/system/dict/modules/form-type.vue` | 同步 `is_enabled → isEnabled`（如果存在） |

## 4. 数据流 / 字段流图

```
[React-Admin drawer]  ──camel──▶ [axios PUT]  ──camel──▶  [mock handler]
                                                                       │
                                                                       ▼
                                                          pickCamelKeys → 校验 → snake 写内存
                                                                       │
                                                                       ▼
[React-Admin list]  ◀──camel──  [axios GET]  ◀──camel──  toCamelRow(list[idx])
```

```
[Vue drawer]        ──camel──▶ [requestClient PUT] ──camel──▶ [mock handler] （同上）
```

## 5. 权衡与兼容性

- **容错 snake 入参**：handler 同时接受 snake，迁移期保证 snake 写法的 curl 调试也能成功。
- **不接受混合大小写**：若同一次请求同时带 `isDefault` 与 `is_default`，以 camel 为准（`pickCamelKeys` 顺序保证）。
- **错误信息指向 camelCase**：避免双重表述带来的歧义。
- **不动 mock-data 内部类型**：避免 `ensureDictSeeds` 大改；handler 边界转换局部可控。
- **query string 维持现状**：axios / h3 getQuery 已经能透传 `typeCode / status / platform / includeGeneral`，无需为驼峰再改。
- **批量接口 `{action, affected, ids}` 不动**：不属于行字段。

## 6. 上线 / 回滚

- 单仓单 PR，commit 拆 3 个：
  1. `chore(dict-mock): support camelCase input/output for dict-type/dict-data handlers`
  2. `refactor(react-admin): switch dict types + UI to camelCase`
  3. `refactor(vue-vben-admin): switch dict types + UI to camelCase`
- 回滚：单 PR revert 即可；handler 同时接受 snake，理论上回滚到改之前旧前端仍可工作（因为旧前端发 snake）。
- 不需要 feature flag。

## 7. 风险

- **抽屉默认值同步**：`FormValues.isEnabled` 默认 `true`；原 `is_enabled` 默认 `true`。两者一致。
- **列表回显**：原 `dataIndex: 'is_default'` 改 `'isDefault'`，ProTable 通过 dataIndex 读字段，与类型对齐即可，render 函数内同步读 camelCase 字段。
- **mock 进程没重启**：Phase 3 验收时如果 400 重现，需先 `pnpm dev:mock` 重启。
- **vben form schema 的 `tag_type` 字段名**：vben form 内部对字段名敏感，schema 改 `tag_type → tagType` 时要同步 form.vue 的 model key，否则 defaultValue 不会落到 form.values。