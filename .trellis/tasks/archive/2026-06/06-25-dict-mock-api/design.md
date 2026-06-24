# 字典管理 backend-mock API — 技术设计

## 文件结构

```
apps/backend-mock-template/
├── api/system/dict-type/
│   ├── list.ts                  GET 分页
│   ├── all.ts                   GET 全部（下拉）
│   ├── [id].ts                  GET 详情
│   ├── index.post.ts            POST 创建
│   ├── [id].put.ts              PUT 更新
│   └── [id].delete.ts           DELETE 删除
├── api/system/dict-data/
│   ├── list.ts                  GET 分页
│   ├── by-type/[code].ts        GET by typeCode
│   ├── index.post.ts            POST 创建
│   ├── [id].put.ts              PUT 更新
│   └── [id].delete.ts           DELETE 删除
├── middleware/1.api.ts          【改】白名单加 dict-type / dict-data
└── utils/mock-data.ts           【改】新增 getMockDictTypeList / getMockDictDataList
```

## 共享状态（mock-data.ts 扩展）

```ts
const mockDictTypeList: DictType[] = [];
const mockDictDataList: DictData[] = [];

export function getMockDictTypeList() { return mockDictTypeList; }
export function getMockDictDataList() { return mockDictDataList; }

// 种子（首次 list 触发惰性写入）
const seedDictTypes: DictType[] = [
  { code: 'sys_user_sex',  name: '用户性别',  remark: '...', is_enabled: 1, ... },
  { code: 'sys_yes_no',    name: '系统是否',  remark: '...', is_enabled: 1, ... },
  { code: 'sys_menu_type', name: '菜单类型',  remark: '...', is_enabled: 1, ... },
  { code: 'sys_notice_type', name: '通知类型', remark: '...', is_enabled: 1, ... },
  { code: 'sys_common_status', name: '通用状态', remark: '...', is_enabled: 1, ... },
];
const seedDictData: DictData[] = [
  // sys_user_sex → 男/女/未知
  // sys_yes_no → 是/否
  // sys_menu_type → 目录/菜单/按钮
  // sys_notice_type → 通知/公告/提醒
  // sys_common_status → 正常/停用
];
```

惰性初始化策略沿用 `system/user/list.ts`：首次 list 请求时若 `mockDictTypeList.length === 0` 则 push 种子。

## 关键约定

### ID 生成

```ts
function nextId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
```

足够 demo 用，避免与已有 user 冲突。

### 软删语义

mock 不真正按 `deleted_at` 过滤（保持简单），但删除时仍写 `deleted_at = Date.now()`，便于将来切真表时一行 SQL 兼容。所有 list 查询仍然返回未删项（内存层手动 `filter(item => item.deleted_at === 0)`），写入时也校验不能新增与已删记录 code 重复。

### 中间件白名单

```ts
// middleware/1.api.ts 【改】
const writeWhitelist = [
  '/api/system/user/',
  '/api/system/dict-type/',
  '/api/system/dict-data/',
];
```

替换原硬编码 `!event.path.startsWith("/api/system/user/")`。

### 错误规范

所有 4xx 返回 `setResponseStatus(event, 400|404)` + `useResponseError('Code', 'msg')`，与 user 一致。

### 时间格式

`created_at` / `updated_at` 用 `new Date().toISOString()`。读列表时前端拿到 ISO 字符串即可，前端按需格式化。

## 接口签名（详细）

### GET /api/system/dict-type/list

```ts
export default defineEventHandler(async (event) => {
  const { page = 1, pageSize = 20, code, name, status } = getQuery(event);
  const list = ensureSeed(getMockDictTypeList());
  let filtered = list.filter(x => x.deleted_at === 0);
  if (code) filtered = filtered.filter(x => x.code.toLowerCase().includes(String(code).toLowerCase()));
  if (name) filtered = filtered.filter(x => x.name.includes(String(name)));
  if (['0','1'].includes(status as string)) filtered = filtered.filter(x => x.is_enabled === Number(status));
  return usePageResponseSuccess(page as string, pageSize as string, filtered);
});
```

### GET /api/system/dict-type/all

不分页，按 status 可选过滤；返回 `useResponseSuccess(items)` 而非 page 包装，便于下拉直接遍历。

### POST /api/system/dict-type

- 校验 `code` 必填且 `^[a-z][a-z0-9_]{0,63}$`；`name` 必填且 1-64 字符；`remark` 可选默认 ''；`is_enabled` 默认 1。
- 校验 code 全表唯一（按 deleted_at=0）。
- 写 created_at / updated_at / created_by / updated_by = 0。
- unshift 到数组。
- 返回 `useResponseSuccess(newRow)`。

### PUT /api/system/dict-type/[id]

- 找记录，找不到 404。
- 仅允许更新 `name / remark / is_enabled`（code 改了就破坏唯一性，禁用）。前端不传 code。
- 更新 `updated_at`。

### DELETE /api/system/dict-type/[id]

- 找记录，找不到 404。
- 若 `getMockDictDataList().some(d => d.type_id === id && d.deleted_at === 0)` → 400 + 「请先清空字典项」。
- 写 `deleted_at = Date.now()`，模拟软删。

### GET /api/system/dict-data/list

```ts
const { page, pageSize, typeId, label, value, status } = getQuery(event);
let filtered = ensureSeed(getMockDictDataList()).filter(x => x.deleted_at === 0);
if (typeId) filtered = filtered.filter(x => x.type_id === Number(typeId));
if (label)  filtered = filtered.filter(x => x.label.includes(String(label)));
if (value)  filtered = filtered.filter(x => x.value.includes(String(value)));
if (['0','1'].includes(status)) filtered = filtered.filter(x => x.is_enabled === Number(status));
// 按 sort ASC, id ASC 排序
filtered.sort((a, b) => a.sort - b.sort || a.id - b.id);
return usePageResponseSuccess(page, pageSize, filtered);
```

### GET /api/system/dict-data/by-type/[code]

- 找 `dict_type.code === code` 的 type_id；
- 返回 `useResponseSuccess(dictData.filter(d => d.type_id === typeId && d.is_enabled === 1))`。

### POST /api/system/dict-data

- 校验 `typeId / value / label` 必填；`value` 同 typeId 内唯一。
- 写 `sort = body.sort ?? 0`，`is_default = body.isDefault ? 1 : 0`，`is_enabled = body.is_enabled ?? 1`，`remark = body.remark ?? ''`。
- 校验 `typeId` 必须指向未删的 dict_type，否则 400。

### PUT /api/system/dict-data/[id]

- 找记录，找不到 404。
- 允许更新 `value / label / sort / is_default / is_enabled / remark`；不允许改 typeId / id。
- 改 value 时校验同 typeId 唯一。

### DELETE /api/system/dict-data/[id]

- 写 `deleted_at = Date.now()`，无额外约束。

## 验证清单

- [ ] `pnpm dev` 启动，访问 `GET /api/system/dict-type/list?page=1&pageSize=10` 返回种子。
- [ ] `POST /api/system/dict-type` body `{code:"x", name:"X"}` 返回新记录。
- [ ] 再 POST 同 code → 400 + 已存在。
- [ ] `DELETE /api/system/dict-type/<id>` 在仍有 dict-data 时返回 400。
- [ ] 先 DELETE 所有 dict-data 再 DELETE dict-type → 200。
- [ ] `GET /api/system/dict-data/list?typeId=1&page=1&pageSize=5` 返回分页。
- [ ] `GET /api/system/dict-data/by-type/sys_yes_no` 返回启用项列表。