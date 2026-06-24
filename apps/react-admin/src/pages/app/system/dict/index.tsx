import { useEffect, useRef, useState } from 'react';
import { Button, Col, message, Modal, Row } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  ProTable,
  TableDropdown,
} from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  deleteDictDataApi,
  listDictDataApi,
} from '@/api/rest/dict-data';
import {
  deleteDictTypeApi,
  listAllDictTypeApi,
  listDictTypeApi,
} from '@/api/rest/dict-type';
import type { DictData, DictType } from '@/api/rest/types';
import ContentContainer from '@/layouts/components/PageContainer/ContentContainer';
import DictTypeDrawer from './modules/dict-type-drawer';
import DictDataDrawer from './modules/dict-data-drawer';

/* ---------- 状态字段辅助 ---------- */
function statusOrUndefined(v: number | '' | undefined): 0 | 1 | undefined {
  if (v === '' || v === undefined) return undefined;
  return Number(v) as 0 | 1;
}

/* ---------- 列：字典类型 ---------- */
const typeColumns: ProColumns<DictType>[] = [
  { title: 'ID', dataIndex: 'id', width: 80, search: false },
  { title: '类型编码', dataIndex: 'code', width: 140, ellipsis: true },
  { title: '类型名称', dataIndex: 'name', width: 140, ellipsis: true },
  {
    title: '备注',
    dataIndex: 'remark',
    ellipsis: true,
    search: false,
    render: (_, r) =>
      r.remark ? (
        <span title={r.remark}>{r.remark}</span>
      ) : (
        <span style={{ color: '#999' }}>-</span>
      ),
  },
  {
    title: '状态',
    dataIndex: 'is_enabled',
    width: 90,
    valueType: 'select',
    valueEnum: {
      1: { text: '启用' },
      0: { text: '禁用' },
    },
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 170,
    valueType: 'dateTime',
    search: false,
  },
  {
    title: '操作',
    valueType: 'option',
    key: 'option',
    width: 120,
    fixed: 'right',
  },
];

/* ---------- 列：字典项 ---------- */
const dataColumns: ProColumns<DictData>[] = [
  { title: 'ID', dataIndex: 'id', width: 80, search: false },
  { title: '字典值', dataIndex: 'value', width: 120 },
  { title: '字典标签', dataIndex: 'label', width: 140, ellipsis: true },
  { title: '排序', dataIndex: 'sort', width: 80, search: false },
  {
    title: '默认',
    dataIndex: 'is_default',
    width: 80,
    search: false,
    render: (_, r) =>
      r.is_default === 1 ? (
        <span style={{ color: '#1677ff' }}>默认</span>
      ) : (
        <span style={{ color: '#999' }}>-</span>
      ),
  },
  {
    title: '状态',
    dataIndex: 'is_enabled',
    width: 90,
    valueType: 'select',
    valueEnum: {
      1: { text: '启用', status: 'Success' },
      0: { text: '禁用', status: 'Default' },
    },
  },
  {
    title: '备注',
    dataIndex: 'remark',
    ellipsis: true,
    search: false,
    render: (_, r) =>
      r.remark ? (
        <span title={r.remark}>{r.remark}</span>
      ) : (
        <span style={{ color: '#999' }}>-</span>
      ),
  },
  {
    title: '操作',
    valueType: 'option',
    key: 'option',
    width: 120,
    fixed: 'right',
  },
];

const DictPage = () => {
  const typeActionRef = useRef<ActionType | undefined>(undefined);
  const entryActionRef = useRef<ActionType | undefined>(undefined);

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<DictType | null>(null);

  // 抽屉
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState<DictType | null>(null);
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictData | null>(null);

  // 「新建条目」下拉
  const [typeOptions, setTypeOptions] = useState<
    { label: string; value: number }[]
  >([]);
  useEffect(() => {
    listAllDictTypeApi({ status: 1 })
      .then((list) =>
        setTypeOptions(
          list.map((t: DictType) => ({
            label: `${t.name}（${t.code}）`,
            value: t.id,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  // 渲染「操作」列
  function renderTypeActions(
    _: unknown,
    record: DictType,
    __: unknown,
    action?: ActionType,
  ) {
    return [
      <a
        key="edit"
        onClick={(e) => {
          e.stopPropagation();
          setEditingType(record);
          setTypeDrawerOpen(true);
        }}
      >
        编辑
      </a>,
      <TableDropdown
        key="more"
        onSelect={(key) => {
          if (key === 'delete') {
            Modal.confirm({
              title: '确认删除该字典类型？',
              okText: '删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: async () => {
                try {
                  await deleteDictTypeApi(record.id);
                  message.success('删除成功');
                  action?.reload?.();
                  if (selectedTypeId === record.id) {
                    setSelectedTypeId(null);
                    setSelectedType(null);
                    entryActionRef.current?.reload?.();
                  }
                } catch (err) {
                  message.error(`删除失败：${(err as Error).message ?? '未知错误'}`);
                }
              },
            });
          }
        }}
        menus={[{ key: 'delete', name: '删除' }]}
      />,
    ];
  }

  function renderEntryActions(
    _: unknown,
    record: DictData,
    __: unknown,
    action?: ActionType,
  ) {
    return [
      <a
        key="edit"
        onClick={() => {
          setEditingEntry(record);
          setEntryDrawerOpen(true);
        }}
      >
        编辑
      </a>,
      <TableDropdown
        key="more"
        onSelect={(key) => {
          if (key === 'delete') {
            Modal.confirm({
              title: '确认删除该字典项？',
              okText: '删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: async () => {
                try {
                  await deleteDictDataApi(record.id);
                  message.success('删除成功');
                  action?.reload?.();
                } catch (err) {
                  message.error(`删除失败：${(err as Error).message ?? '未知错误'}`);
                }
              },
            });
          }
        }}
        menus={[{ key: 'delete', name: '删除' }]}
      />,
    ];
  }

  // 注入 render
  const typeCols: ProColumns<DictType>[] = typeColumns.map((c) =>
    c.key === 'option' ? { ...c, render: renderTypeActions } : c,
  );
  const entryCols: ProColumns<DictData>[] = dataColumns.map((c) =>
    c.key === 'option' ? { ...c, render: renderEntryActions } : c,
  );

  /* ---------- 列表请求 ---------- */
  async function fetchTypeRows(
    params: Record<string, unknown> & {
      current?: number;
      pageSize?: number;
      code?: string;
      name?: string;
      is_enabled?: number | '';
    },
  ) {
    const {
      current = 1,
      pageSize = 10,
      code,
      name,
      is_enabled,
    } = params;
    const res = await listDictTypeApi({
      page: current,
      pageSize,
      code: code || undefined,
      name: name || undefined,
      status: statusOrUndefined(is_enabled),
    });
    return { data: res.items, total: res.total, success: true };
  }

  async function fetchEntryRows(
    params: Record<string, unknown> & {
      current?: number;
      pageSize?: number;
      typeId?: number;
      value?: string;
      label?: string;
      is_enabled?: number | '';
    },
  ) {
    const {
      current = 1,
      pageSize = 20,
      typeId,
      value,
      label,
      is_enabled,
    } = params;
    if (!typeId) {
      return { data: [], total: 0, success: true };
    }
    const res = await listDictDataApi({
      page: current,
      pageSize,
      typeId,
      value: value || undefined,
      label: label || undefined,
      status: statusOrUndefined(is_enabled),
    });
    return { data: res.items, total: res.total, success: true };
  }

  /* ---------- 保存后回调 ---------- */
  function onTypeSaved() {
    message.success(editingType ? '保存成功' : '创建成功');
    typeActionRef.current?.reload?.();
    if (!editingType) {
      entryActionRef.current?.reload?.();
    }
  }
  function onEntrySaved() {
    message.success(editingEntry ? '保存成功' : '创建成功');
    entryActionRef.current?.reload?.();
  }

  /* ---------- 工具栏按钮 ---------- */
  const typeToolbar = () => [
    <Button
      key="create"
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => {
        setEditingType(null);
        setTypeDrawerOpen(true);
      }}
    >
      新建类型
    </Button>,
  ];

  const entryToolbar = () => [
    <Button
      key="create"
      type="primary"
      icon={<PlusOutlined />}
      disabled={!selectedTypeId}
      onClick={() => {
        if (!selectedTypeId) {
          message.warning('请先在左侧选择一个字典类型');
          return;
        }
        setEditingEntry(null);
        setEntryDrawerOpen(true);
      }}
    >
      新建条目
    </Button>,
  ];

  return (
    <ContentContainer heightMode="auto" scrollable padding="16px">
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <ProTable<DictType>
            headerTitle="字典类型"
            cardBordered
            rowKey="id"
            actionRef={typeActionRef}
            columns={typeCols}
            search={{ labelWidth: 'auto' }}
            request={fetchTypeRows}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            toolBarRender={typeToolbar}
            options={{
              reload: () => typeActionRef.current?.reload?.(),
              setting: { listsHeight: 400 },
            }}
            dateFormatter="string"
            onRow={(record) => ({
              onClick: () => {
                setSelectedTypeId(record.id);
                setSelectedType(record);
                entryActionRef.current?.reload?.();
              },
              style: {
                cursor: 'pointer',
                background:
                  selectedTypeId === record.id
                    ? 'rgba(59,130,246,0.08)'
                    : undefined,
              },
            })}
            tableAlertRender={false}
            rowSelection={false}
          />
        </Col>

        <Col xs={24} md={12}>
          <ProTable<DictData>
            headerTitle={
              selectedType
                ? `字典数据：${selectedType.name}（${selectedType.code}）`
                : '字典数据（请先选择左侧类型）'
            }
            cardBordered
            rowKey="id"
            actionRef={entryActionRef}
            columns={entryCols}
            search={{ labelWidth: 'auto' }}
            params={{ typeId: selectedTypeId ?? undefined }}
            request={fetchEntryRows}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            toolBarRender={entryToolbar}
            options={{
              reload: () => entryActionRef.current?.reload?.(),
              setting: { listsHeight: 400 },
            }}
            dateFormatter="string"
            locale={{
              emptyText: selectedTypeId ? '暂无数据' : '请先在左侧选择字典类型',
            }}
          />
        </Col>
      </Row>

      <DictTypeDrawer
        open={typeDrawerOpen}
        row={editingType}
        onClose={() => setTypeDrawerOpen(false)}
        onSaved={onTypeSaved}
      />
      <DictDataDrawer
        open={entryDrawerOpen}
        row={editingEntry}
        defaultTypeId={selectedTypeId ?? undefined}
        typeOptions={typeOptions}
        onClose={() => setEntryDrawerOpen(false)}
        onSaved={() => onEntrySaved()}
      />
    </ContentContainer>
  );
};

export default DictPage;
