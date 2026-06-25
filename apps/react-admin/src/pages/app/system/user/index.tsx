import { useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
  Popconfirm,
} from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from '@/api/hooks/user';
import type {
  CreateUserRequest,
  UserListItem,
  UserListQuery,
} from '@/api/rest/types';
import ContentContainer from '@/layouts/components/PageContainer/ContentContainer';

interface SearchValues {
  username?: string;
  realName?: string;
  status?: 0 | 1;
}

const UserPage = () => {
  const [query, setQuery] = useState<UserListQuery>({ page: 1, pageSize: 10 });
  const [search, setSearch] = useState<SearchValues>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [form] = Form.useForm<CreateUserRequest>();

  const fullQuery: UserListQuery = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
    ...search,
  };
  const { data, isLoading, refetch } = useListUsers(fullQuery);

  const createMutation = useCreateUser({
    onSuccess: () => {
      message.success('创建成功');
      setCreateOpen(false);
      form.resetFields();
      refetch();
    },
    onError: (err) => message.error(`创建失败：${(err as Error).message ?? '未知错误'}`),
  });
  const updateMutation = useUpdateUser({
    onSuccess: () => {
      message.success('保存成功');
      setEditing(null);
      form.resetFields();
      refetch();
    },
    onError: (err) => message.error(`保存失败：${(err as Error).message ?? '未知错误'}`),
  });
  const deleteMutation = useDeleteUser({
    onSuccess: () => {
      message.success('删除成功');
      refetch();
    },
    onError: (err) => message.error(`删除失败：${(err as Error).message ?? '未知错误'}`),
  });

  const columns: TableColumnsType<UserListItem> = [
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: '姓名', dataIndex: 'realName', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 200, ellipsis: true },
    { title: '电话', dataIndex: 'phone', width: 140 },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 160,
      render: (roles: string[] = []) =>
        roles.map((r) => (
          <Tag color={r === 'super' ? 'magenta' : r === 'admin' ? 'blue' : 'default'} key={r}>
            {r}
          </Tag>
        )),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: 0 | 1) => (
        <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createTime', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  function openEdit(record: UserListItem) {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      realName: record.realName,
      email: record.email,
      phone: record.phone,
      status: record.status,
      roles: record.roles,
      remark: record.remark,
    });
  }

  function handleSubmit() {
    form
      .validateFields()
      .then((values) => {
        if (editing) {
          updateMutation.mutate({ id: editing.id, data: values });
        } else {
          createMutation.mutate(values);
        }
      })
      .catch(() => {
        // 校验失败由 Form 自身提示
      });
  }

  function handleTableChange(pagination: TablePaginationConfig) {
    setQuery((q) => ({
      ...q,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 10,
    }));
  }

  return (
    <ContentContainer heightMode="auto" scrollable padding="16px">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="用户名"
          allowClear
          style={{ width: 180 }}
          value={search.username}
          onChange={(e) => setSearch((s) => ({ ...s, username: e.target.value || undefined }))}
          onPressEnter={() => setQuery((q) => ({ ...q, page: 1 }))}
        />
        <Input
          placeholder="姓名"
          allowClear
          style={{ width: 180 }}
          value={search.realName}
          onChange={(e) => setSearch((s) => ({ ...s, realName: e.target.value || undefined }))}
          onPressEnter={() => setQuery((q) => ({ ...q, page: 1 }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          value={search.status}
          onChange={(v) => {
            setSearch((s) => ({ ...s, status: v }));
            setQuery((q) => ({ ...q, page: 1 }));
          }}
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '禁用' },
          ]}
        />
        <Button
          type="primary"
          onClick={() => {
            setQuery((q) => ({ ...q, page: 1 }));
            refetch();
          }}
        >
          搜索
        </Button>
        <Button onClick={() => setSearch({})} disabled={!search.username && !search.realName && search.status === undefined}>
          重置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ status: 1, roles: ['user'] });
            setCreateOpen(true);
          }}
        >
          新建
        </Button>
      </Space>

      <Table<UserListItem>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        scroll={{ x: 1100 }}
        pagination={{
          current: query.page ?? 1,
          pageSize: query.pageSize ?? 10,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
      />

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={createOpen || !!editing}
        onCancel={() => {
          setCreateOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input disabled={!!editing} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item name="roles" label="角色">
            <Select
              mode="multiple"
              placeholder="选择角色"
              options={[
                { value: 'user', label: 'user' },
                { value: 'admin', label: 'admin' },
                { value: 'super', label: 'super' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked" getValueFromEvent={(v) => (v ? 1 : 0)} getValueProps={(v) => ({ checked: v === 1 })}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>
    </ContentContainer>
  );
};

export default UserPage;
