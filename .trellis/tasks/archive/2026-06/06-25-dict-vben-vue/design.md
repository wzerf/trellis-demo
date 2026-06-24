# 字典管理 vue-vben-admin (web-naive) — 技术设计

## 文件清单

```
apps/vue-vben-admin/apps/web-naive/src/
├── api/
│   └── system/
│       ├── index.ts            re-export dict-type / dict-data
│       ├── dict-type.ts        6 个方法
│       └── dict-data.ts        5 个方法
├── router/
│   └── routes/
│       └── modules/
│           └── system.ts       新增 system 父路由 + /system/dict 子路由
├── views/
│   └── system/
│       └── dict/
│           ├── index.vue               主页（双表 + 抽屉触发）
│           └── modules/
│               ├── dict-type-drawer.vue
│               ├── dict-data-drawer.vue
│               └── shared.ts           共享 type / status 枚举
└── locales/
    └── langs/
        ├── zh-CN/system.json   dict 管理文案
        └── en-US/system.json
```

## API 封装约定

沿用 `src/api/core/user.ts` 风格，从 `#/api/request` 导入 `requestClient`。

```ts
// src/api/system/dict-type.ts
import type { Recordable } from '@vben/types';
import { requestClient } from '#/api/request';

export interface DictType {
  id: number;
  code: string;
  name: string;
  remark: string;
  is_enabled: 0 | 1;
  deleted_at: number;
  created_at: string;
  updated_at: string;
}

export interface DictTypeListParams {
  page?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  status?: 0 | 1 | '';
}

export interface DictTypePageResp {
  items: DictType[];
  total: number;
}

// list 与 getAll 都返回 data.data（已被 responseReturn:'data' 拆掉外层）
export async function fetchDictTypeListApi(params: DictTypeListParams) {
  return requestClient.get<DictTypePageResp>('/system/dict-type/list', { params });
}
export async function fetchAllDictTypesApi(params?: { status?: 0 | 1 }) {
  return requestClient.get<DictType[]>('/system/dict-type/all', { params });
}
export async function getDictTypeApi(id: number) {
  return requestClient.get<DictType>(`/system/dict-type/${id}`);
}
export async function createDictTypeApi(body: { code: string; name: string; remark?: string; is_enabled?: 0 | 1 }) {
  return requestClient.post<DictType>('/system/dict-type', body);
}
export async function updateDictTypeApi(id: number, body: Partial<DictType>) {
  return requestClient.put<DictType>(`/system/dict-type/${id}`, body);
}
export async function deleteDictTypeApi(id: number) {
  return requestClient.delete<void>(`/system/dict-type/${id}`);
}
```

dict-data 模块同形态，差异是 list 多了 `typeId` 过滤、`by-type/[code]` 走 `/system/dict-data/by-type/${code}`。

## 路由

```ts
// src/router/routes/modules/system.ts
import type { RouteRecordRaw } from 'vue-router';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    name: 'System',
    path: '/system',
    meta: {
      icon: 'lucide:settings',
      order: 2005,
      title: $t('system.title'),
    },
    children: [
      {
        name: 'SystemDict',
        path: 'dict',
        component: () => import('#/views/system/dict/index.vue'),
        meta: {
          icon: 'lucide:book-marked',
          title: $t('system.dict.title'),
        },
      },
    ],
  },
];

export default routes;
```

## 页面布局

`views/system/dict/index.vue` 顶部为面包屑 / page header；主体使用 `n-grid cols="1 m:2" responsive="screen"` 形成双列：

```
<NCard :title="$t('system.dict.types')">
  <template #header-extra>
    <NButton type="primary" @click="openTypeDrawer()">+ {{ $t('system.dict.newType') }}</NButton>
  </template>
  <NDataTable
    :columns="typeColumns"
    :data="typeRows"
    :pagination="typePagination"
    :loading="typeLoading"
    :row-key="row => row.id"
    :row-class-name="row => selectedTypeId === row.id ? 'selected' : ''"
    @row-click="onSelectType"
    size="small"
    striped
  />
</NCard>

<NCard :title="rightTitle">
  <template #header-extra>
    <NButton type="primary" :disabled="!selectedTypeId" @click="openDataDrawer()">+ {{ $t('system.dict.newEntry') }}</NButton>
  </template>
  <NDataTable ... />
</NCard>
```

- 选中态通过 `selectedTypeId` 控制；点击字典类型行 → 加载字典项。
- 过滤栏放在每个 NCard 顶部 slot。
- 状态列用 NSwitch，编辑走 NDrawer（width 560）。

## Drawer

`dict-type-drawer.vue`：

```ts
const model = ref<{ code: string; name: string; remark: string; is_enabled: 0 | 1 }>({
  code: '', name: '', remark: '', is_enabled: 1,
});

const rules = {
  code: [
    { required: true, message: $t('ui.required') },
    { pattern: /^[a-z][a-z0-9_]*$/, message: $t('system.dict.codeRule') },
  ],
  name: [{ required: true, message: $t('ui.required') }],
};
```

`dict-data-drawer.vue` 同形态，多一个 `typeId` Select（数据来自 `fetchAllDictTypesApi`，仅展示启用项）。

## i18n key 设计

`zh-CN/system.json`（节选）：

```json
{
  "title": "系统管理",
  "dict": {
    "title": "字典管理",
    "types": "字典类型",
    "entries": "字典数据",
    "newType": "新建类型",
    "newEntry": "新建条目",
    "code": "类型编码",
    "name": "类型名称",
    "remark": "备注",
    "status": "状态",
    "enabled": "启用",
    "disabled": "禁用",
    "codeRule": "以小写字母开头，仅含字母数字下划线",
    "selectTypeFirst": "请先在左侧选择一个字典类型",
    "typeHasEntries": "该类型仍有字典项，请先清空",
    "value": "字典值",
    "label": "字典标签",
    "sort": "排序",
    "isDefault": "是否默认",
    "default": "默认",
    "yes": "是",
    "no": "否",
    "createOk": "创建成功",
    "updateOk": "更新成功",
    "deleteOk": "删除成功"
  }
}
```

英文同构；共用 key 在两个文件中分别写。

## 错误处理

复用 `request.ts` 中的 `errorMessageResponseInterceptor`：后端 400 时返回 `{ code:-1, message:'xxx', error:'xxx' }`，`useMessage().error(error || message)` 已经能提示；前端不做额外拦截。

但「类型仍有条目」是 400 来自后端；前端可以在 `deleteDictTypeApi` 调用前先查 list，更优；为减少请求次数，直接信任后端响应并 toast。删除前先用 NPopconfirm 让用户确认。

## 依赖与脚本

- 不引入新依赖（沿用 Naive UI + vben hooks）。
- `pnpm --filter web-naive dev` 启动；mock 通过根目录的 `apps/backend-mock-template` 已绑定（端口 4000），前端通过 Vite 代理 `/api` 转发。