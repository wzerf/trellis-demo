# 字典管理跨端实现（Vue vben-admin / React admin / Backend-mock）

## 目标

在 `apps/backend-mock-template`、`apps/vue-vben-admin/apps/web-naive`、`apps/react-admin` 三个代码库上分别落地字典管理功能。Vue 与 React 共用 backend-mock 提供的同一组 REST 接口；视觉与交互对齐 Open Design 项目 `26ea31e4-e18d-48d0-8fce-7ac6ce3485e6` 的原型（master-detail 双表 + drawer + 状态开关）。

数据契约以原型 `mql4ww2b-schema.sql` 中 `dict_type` / `dict_data` 两张表的字段为准；内存实现，进程重启会丢失。

## 子任务地图

| 任务目录 | 范围 | 依赖 |
|---|---|---|
| `.trellis/tasks/06-25-dict-mock-api` | backend-mock 新增 `/api/system/dict-type/*` 与 `/api/system/dict-data/*` | — |
| `.trellis/tasks/06-25-dict-vben-vue` | web-naive 新增 `/system/dict` 页面 + API 封装 + i18n | dict-mock-api |
| `.trellis/tasks/06-25-dict-react-admin` | react-admin 新增 `/system/dict` 页面 + 替换 `dict.ts` / `useDictCache.ts` stub + i18n | dict-mock-api |

## 全局接口契约（跨端唯一）

所有列表返回 `usePageResponseSuccess` 包装：`{ code: 0, data: { items, total }, error, message }`。
所有写操作返回 `useResponseSuccess`：`{ code: 0, data, error: null, message: 'ok' }`。
错误返回 `useResponseError`：`{ code: -1, data: null, error, message }`。

### dict-type

| Method | Path | Query / Body |
|---|---|---|
| GET | `/api/system/dict-type/list` | `page, pageSize, code, name, status` |
| GET | `/api/system/dict-type/all` | `status?` 字典下拉；不分页，返回全部 |
| GET | `/api/system/dict-type/[id]` | 详情 |
| POST | `/api/system/dict-type` | body: `code, name, remark?, is_enabled?` |
| PUT | `/api/system/dict-type/[id]` | body: 部分字段 |
| DELETE | `/api/system/dict-type/[id]` | — |

字段：`id, code, name, remark, is_enabled (0|1), deleted_at (0=未删), created_at, updated_at`。

### dict-data

| Method | Path | Query / Body |
|---|---|---|
| GET | `/api/system/dict-data/list` | `page, pageSize, typeId, label, value, status` |
| GET | `/api/system/dict-data/by-type/[typeCode]` | 不分页；按类型编码取所有启用项 |
| POST | `/api/system/dict-data` | body: `typeId, value, label, sort?, isDefault?, is_enabled?, remark?` |
| PUT | `/api/system/dict-data/[id]` | body: 部分字段 |
| DELETE | `/api/system/dict-data/[id]` | — |

字段：`id, type_id, value, label, sort, is_default (0|1), is_enabled (0|1), deleted_at, remark, created_at, updated_at`。

## 跨端验收标准

- [ ] 三端代码都可独立启动；vue-vben-admin 与 react-admin 都依赖 backend-mock-template 的同一个 mock 实例（端口 4000）。
- [ ] 在任一前端登录后，访问 `/system/dict`，左侧字典类型表、右侧字典项表均能正常加载、搜索、翻页。
- [ ] 新建/编辑/删除字典类型与字典项在三端都生效，且操作有 loading 状态、成功 / 失败提示。
- [ ] 启用状态切换走开关组件，操作立即生效；禁用项仍可见但有视觉区分。
- [ ] 删除字典类型时，若该类型仍有字典项，前端拦截并提示「请先清空字典项」。
- [ ] 字段命名（id / code / name / value / label / is_enabled / sort）与 schema.sql 严格一致。

## 非目标

- 不实现持久化（不接 MySQL / Postgres）。
- 不实现 i18n 标签键编辑（schema 中 dict_data 仅 label 一列，不引入 i18n 翻译）。
- 不实现 Casbin 权限码绑定；增删改权限临时放空。
- 不实现导入 / 导出。

## 风险与备注

- `apps/backend-mock-template/middleware/1.api.ts` 默认拦截所有 `/api/system/*` 写操作（除 user），需要在本次实现里把 `/api/system/dict-type/` 和 `/api/system/dict-data/` 也加入白名单，否则演示环境无法 CRUD。
- Open Design 原型是单文件 `index.html` + `admin.js`，运行时暗色主题 + master-detail 双表布局；前端实现不强行 1:1 还原 CSS 类，但页面布局、交互节奏、信息密度对齐。