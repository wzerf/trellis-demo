# 字典管理 react-admin — 技术设计

## 文件清单

```
apps/react-admin/src/
├── api/
│   ├── rest/
│   │   ├── dict-type.ts        6 个 REST 方法
│   │   ├── dict-data.ts        5 个 REST 方法
│   │   ├── types.ts            【改】追加 DictType / DictData / *Query / *Request 类型
│   │   └── index.ts            【改】re-export dict-type / dict-data
│   └── hooks/
│       ├── dict.ts             【改】真实实现；useQuery + useMutation 10 个 hook
│       └── index.ts            【改】re-export ./dict
├── pages/
│   └── app/
│       └── system/
│           └── dict/
│               ├── index.tsx                       主页
│               └── modules/
│                   ├── dict-type-drawer.tsx
│                   ├── dict-data-drawer.tsx
│                   └── shared.ts
├── router/
│   └── modules/
│       └── system.tsx          【改】在 children 加 dict 路由
└── locales/
    ├── zh-CN/_modules/dict-type.json   【改】扩充文案
    ├── zh-CN/_modules/dict-entry.json  【改】
    ├── en-US/_modules/dict-type.json
    ├── en-US/_modules/dict-entry.json
    ├── zh-CN/_core/routes.json         【改】加 system.dict.title
    └── en-US/_core/routes.json
```

## 类型与 REST 封装（types.ts + dict-type.ts）

```ts
// src/api/rest/types.ts
export interface DictType {
  id: number;
  code: string;
  name: string;
  remark: string;
  is_enabled: 0 | 1;
  deleted_at: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface DictData {
  id: number;
  type_id: number;
  value: string;
  label: string;
  sort: number;
  is_default: 0 | 1;
  is_enabled: 0 | 1;
  deleted_at: number;
  remark: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface DictTypeQuery {
  page?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  status?: 0 | 1 | '';
}

export interface CreateDictTypeRequest {
  code: string;
  name: string;
  remark?: string;
  is_enabled?: 0 | 1;
}

export interface UpdateDictTypeRequest extends Partial<CreateDictTypeRequest> {
  id: number;
}

// dictData 同形态
```

```ts
// src/api/rest/dict-type.ts
import type { PageResult, DictType, DictTypeQuery, CreateDictTypeRequest, UpdateDictTypeRequest } from './types';
import request from './request';

export async function listDictTypeApi(q: DictTypeQuery): Promise<PageResult<DictType>> {
  return request.get('/system/dict-type/list', { params: q });
}
export async function listAllDictTypeApi(params?: { status?: 0 | 1 }): Promise<DictType[]> {
  return request.get('/system/dict-type/all', { params });
}
export async function getDictTypeApi(id: number): Promise<DictType> {
  return request.get(`/system/dict-type/${id}`);
}
export async function createDictTypeApi(body: CreateDictTypeRequest): Promise<DictType> {
  return request.post('/system/dict-type', body);
}
export async function updateDictTypeApi({ id, ...patch }: UpdateDictTypeRequest): Promise<DictType> {
  return request.put(`/system/dict-type/${id}`, patch);
}
export async function deleteDictTypeApi(id: number): Promise<void> {
  return request.delete(`/system/dict-type/${id}`);
}
```

## React Query Hooks

```ts
// src/api/hooks/dict.ts
export function useListDictType(q: DictTypeQuery, options?) {
  return useQuery({ queryKey: ['listDictType', q], queryFn: () => listDictTypeApi(q), ...options });
}
export function useListAllDictType(params?, options?) { /* useQuery */ }
export function useGetDictType(id, options?) { /* useQuery, enabled: !!id */ }
export function useCreateDictType(options?) { return useMutation({ mutationFn: createDictTypeApi, ...options }); }
export function useUpdateDictType(options?) { return useMutation({ mutationFn: updateDictTypeApi, ...options }); }
export function useDeleteDictType(options?) { return useMutation({ mutationFn: deleteDictTypeApi, ...options }); }
// dictData 同样 5 个 hook
```

mutation 成功后 `queryClient.invalidateQueries({ queryKey: ['listDictType'] })` 由各页面 onSuccess 处理。

## 页面布局（index.tsx）

- 使用 `ContentContainer`（参考 user 页）+ 两个 Antd `Card`，Grid 用 `Row gutter={16} <Col xs={24} md={12}>`。
- 状态列用 `Switch`，删除前 `Popconfirm`。
- 字典类型表 `Table.rowSelection={ type: 'radio', selectedRowKeys: [selectedTypeId], onChange: ... }` 让选中态可视。
- 字典项表同形态。
- Drawer：`Antd Drawer`，宽 560。

## Drawer

```tsx
// dict-type-drawer.tsx
const DictTypeDrawer = ({ open, row, onClose, onSaved }) => {
  const [form] = Form.useForm<CreateDictTypeRequest>();
  const createMut = useCreateDictType({ onSuccess: () => { message.success('创建成功'); onSaved(); onClose(); } });
  const updateMut = useUpdateDictType({ onSuccess: () => { message.success('保存成功'); onSaved(); onClose(); } });
  const isEdit = !!row;

  useEffect(() => {
    if (open) form.setFieldsValue(row ?? { code: '', name: '', remark: '', is_enabled: 1 });
  }, [open, row]);

  const handleOk = async () => {
    const values = await form.validateFields();
    if (isEdit) updateMut.mutate({ id: row.id, ...values });
    else createMut.mutate(values);
  };

  return (
    <Drawer title={isEdit ? '编辑类型' : '新建类型'} open={open} onClose={onClose} width={560} onOk={handleOk} confirmLoading={createMut.isPending || updateMut.isPending}>
      <Form form={form} layout="vertical" disabled={isEdit /* code 不可改 */}>
        <Form.Item label="类型编码" name="code" rules={[{ required: true, pattern: /^[a-z][a-z0-9_]*$/, message: '以小写字母开头，仅含字母数字下划线' }]}>
          <Input disabled={isEdit} placeholder="sys_xxx" />
        </Form.Item>
        <Form.Item label="类型名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="备注" name="remark"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="启用" name="is_enabled" valuePropName="checked" getValueFromEvent={(v) => (v ? 1 : 0)} getValueProps={(v) => ({ checked: v === 1 })}>
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
```

`dict-data-drawer.tsx` 同形态，多一个 `typeId` Select。

## 路由

```tsx
// src/router/modules/system.tsx 【改】
import DictPage from '@/pages/app/system/dict';

export const systemRoutes: AppRouteObject[] = [
  {
    name: 'system',
    path: 'system',
    meta: { title: 'routes:system', icon: 'lucide:settings', order: 2005, keepAlive: true },
    children: [
      { name: 'user', path: 'user', element: <UserPage />, meta: { title: 'routes:users', icon: 'lucide:user-cog', order: 1 } },
      { name: 'dict', path: 'dict', element: <DictPage />, meta: { title: 'routes:systemDict', icon: 'lucide:book-marked', order: 2 } },
    ],
  },
];
```

并更新 routes.json 增加 `systemDict: '字典管理'`。

## i18n key

`zh-CN/_modules/dict-type.json`（节选）：

```json
{
  "pageTitle": "字典类型管理",
  "moduleName": "字典类型",
  "typeName": "类型名称",
  "typeNamePlaceholder": "请输入类型名称",
  "requiredTypeName": "请输入类型名称",
  "typeCode": "类型编码",
  "typeCodePlaceholder": "请输入类型编码",
  "requiredTypeCode": "请输入类型编码",
  "codeRule": "以小写字母开头，仅含字母数字下划线",
  "remark": "备注",
  "status": "状态",
  "statusMap": { "true": "启用", "false": "禁用" },
  "create": "新建类型",
  "edit": "编辑类型",
  "createSuccess": "创建成功",
  "updateSuccess": "保存成功",
  "deleteSuccess": "删除成功",
  "deleteConfirmTitle": "确认删除",
  "deleteConfirmDesc": "确定要删除该字典类型吗？",
  "selectTypeFirst": "请先在左侧选择一个字典类型",
  "typeHasEntries": "请先清空字典项"
}
```

`dict-entry.json` 同构（label / value / sort / isDefault / typeId）。

英文版同结构，仅翻译 value。

## useDictCache 兼容

保留导出 `DictEntry / DictType` 接口；`fetchAllDictEntries()` 改为 no-op（同前）；`getDictEntriesOptionsByTypeCode(code)` 改为调 `listAllDictDataApi` + 转换（但默认仍返回空数组以减少冷启动开销）。

## 错误处理

mutation onError：`message.error(err.message ?? '未知错误')`。后端 400 → `err.message` 应为「请先清空字典项」之类，可直接展示。

## 依赖与脚本

- 不引入新依赖。
- `pnpm --filter react-admin dev`（vite 默认端口 5174 左右）。
- 仍通过 `apps/backend-mock-template` 端口 4000 提供数据（vite proxy 已配）。