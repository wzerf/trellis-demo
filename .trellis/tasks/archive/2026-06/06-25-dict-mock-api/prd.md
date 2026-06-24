# 字典管理 backend-mock API

## 目标

在 `apps/backend-mock-template` 上落地字典管理 REST 接口：字典类型 (`dict-type`) 与字典项 (`dict-data`)。两个领域各自实现 list / all / detail / create / update / delete，字段对齐 Open Design 原型 `mql4ww2b-schema.sql`。所有数据存内存，进程重启即清空。

## 范围

新增接口：

```
api/system/dict-type/
  ├── list.ts              GET  分页 + 过滤
  ├── all.ts               GET  不分页（下拉用）
  ├── [id].ts              GET  详情
  ├── index.post.ts        POST 创建
  ├── [id].put.ts          PUT  更新
  └── [id].delete.ts       DELETE 删除（软删标记 deleted_at，非物理删）

api/system/dict-data/
  ├── list.ts              GET  分页 + 过滤
  ├── by-type/[code].ts    GET 按 typeCode 取所有启用项
  ├── index.post.ts        POST 创建
  ├── [id].put.ts          PUT  更新
  └── [id].delete.ts       DELETE 删除
```

修改：

- `middleware/1.api.ts`：把 `/api/system/dict-type/` 与 `/api/system/dict-data/` 加入演示环境写操作白名单（与 user 一致）。
- `utils/mock-data.ts`：新增 `getMockDictTypeList()` / `getMockDictDataList()` 两个共享数组访问器，并预置种子数据（参考 Open Design 原型 admin.js 中的 `MOCK_DICT_TYPES` 与 `MOCK_DICT_ENTRIES`，最少 5 种类型、每种 ≥3 条目）。

## 字段定义

### dict-type

```ts
interface DictType {
  id: number;            // 自增；mock 用 Date.now() + 序号
  code: string;          // 唯一；校验 ^[a-z][a-z0-9_]*$
  name: string;          // 非空
  remark: string;        // 默认 ''
  is_enabled: 0 | 1;     // 默认 1
  deleted_at: number;    // 0=未删；非0=毫秒时间戳（这里 mock 退化为标记，未真正启用软删过滤，前端可见列表过滤直接走 deleted_at=0）
  created_at: string;    // ISO
  updated_at: string;    // ISO
  created_by: number;    // 0=系统
  updated_by: number;    // 0=系统
}
```

### dict-data

```ts
interface DictData {
  id: number;
  type_id: number;       // 引用 dict_type.id
  value: string;         // 同类型内唯一
  label: string;         // 展示用
  sort: number;          // 默认 0
  is_default: 0 | 1;     // 默认 0
  is_enabled: 0 | 1;     // 默认 1
  deleted_at: number;    // 0=未删
  remark: string;        // 默认 ''
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}
```

## 验收标准

- [ ] `pnpm --filter backend-mock-template dev`（或脚本）启动后，所有 12 个 endpoint 都能被 curl 命中。
- [ ] 列表接口支持 `page / pageSize / 关键字 / status` 过滤，返回结构与 `system/user/list` 完全一致（items/total）。
- [ ] 创建时校验必填字段（dict-type 必填 code/name；dict-data 必填 typeId/value/label），返回 400 + useResponseError。
- [ ] 重复 code / 重复 (typeId, value) 返回 400 + 提示。
- [ ] 删除字典类型时若仍存在 dict-data（非删）则返回 400 + 「请先清空字典项」。
- [ ] 写入操作不再被 `middleware/1.api.ts` 拦截（curl POST 后能在后续 GET 看到）。
- [ ] 进程内数据可读写可改；进程重启会重置为种子数据（这是预期行为）。

## 非目标

- 不接数据库，不做持久化。
- 不实现批量接口（前端单条循环）。
- 不实现 i18n 翻译字段。
- 不实现鉴权（与 user CRUD 一致，写操作不调 verifyAccessToken）。

## 风险

- 原型 `admin.js` 中若没有 dict 种子数据，需要从 Open Design 截图人工归纳合理的种子（user_status / user_gender / sys_yes_no / sys_menu_type 等）。
- `middleware/1.api.ts` 改动会改变全局写操作白名单，影响面仅限 demo。