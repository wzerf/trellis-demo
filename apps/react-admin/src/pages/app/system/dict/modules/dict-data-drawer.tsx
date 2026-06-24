import { useEffect } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import {
  useCreateDictData,
  useUpdateDictData,
} from '@/api/hooks/dict';
import type {
  CreateDictDataRequest,
  DictData,
} from '@/api/rest/types';

interface Props {
  open: boolean;
  row: DictData | null;
  /** 抽屉打开时若指定了 typeId，则锁定 typeId 字段不可改（来自双表选中态） */
  defaultTypeId?: number;
  /** 字典类型下拉选项，由父组件传入，避免抽屉内重复请求 */
  typeOptions?: { label: string; value: number }[];
  onClose: () => void;
  onSaved: (row?: DictData) => void;
}

interface FormValues {
  typeId: number;
  value: string;
  label: string;
  sort?: number;
  isDefault?: boolean;
  is_enabled?: boolean;
  remark?: string;
}

const DictDataDrawer = ({
  open,
  row,
  defaultTypeId,
  typeOptions = [],
  onClose,
  onSaved,
}: Props) => {
  const [form] = Form.useForm<FormValues>();
  const createMut = useCreateDictData({
    onSuccess: (created) => {
      message.success('创建成功');
      onSaved(created);
      onClose();
    },
    onError: (err) => {
      message.error(`创建失败：${(err as Error).message ?? '未知错误'}`);
    },
  });
  const updateMut = useUpdateDictData({
    onSuccess: (updated) => {
      message.success('保存成功');
      onSaved(updated);
      onClose();
    },
    onError: (err) => {
      message.error(`保存失败：${(err as Error).message ?? '未知错误'}`);
    },
  });
  const isEdit = !!row;
  const submitting = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!open) return;
    if (row) {
      form.setFieldsValue({
        typeId: row.type_id,
        value: row.value,
        label: row.label,
        sort: row.sort,
        isDefault: row.is_default === 1,
        is_enabled: row.is_enabled === 1,
        remark: row.remark,
      });
    } else {
      form.setFieldsValue({
        typeId: defaultTypeId,
        value: '',
        label: '',
        sort: 0,
        isDefault: false,
        is_enabled: true,
        remark: '',
      });
    }
  }, [open, row, defaultTypeId, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    if (isEdit) {
      updateMut.mutate({
        id: row.id,
        value: values.value,
        label: values.label,
        sort: values.sort ?? 0,
        is_default: values.isDefault ? 1 : 0,
        is_enabled: values.is_enabled ? 1 : 0,
        remark: values.remark ?? '',
      });
    } else {
      const body: CreateDictDataRequest = {
        typeId: values.typeId,
        value: values.value,
        label: values.label,
        sort: values.sort ?? 0,
        isDefault: !!values.isDefault,
        is_enabled: values.is_enabled ? 1 : 0,
        remark: values.remark ?? '',
      };
      createMut.mutate(body);
    }
  };

  return (
    <Drawer
      title={isEdit ? '编辑字典项' : '新建字典项'}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button type="primary" onClick={handleOk} loading={submitting}>
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="所属类型"
          name="typeId"
          rules={[{ required: true, message: '请选择所属类型' }]}
        >
          <Select
            placeholder="请选择类型"
            disabled={isEdit || !!defaultTypeId}
            options={typeOptions}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="字典值"
          name="value"
          rules={[{ required: true, message: '请输入字典值' }, { max: 64 }]}
        >
          <Input disabled={isEdit} placeholder="例如 Y / N / 0 / 1" />
        </Form.Item>
        <Form.Item
          label="字典标签"
          name="label"
          rules={[{ required: true, message: '请输入字典标签' }, { max: 128 }]}
        >
          <Input placeholder="例如 是 / 否 / 启用" />
        </Form.Item>
        <Form.Item label="排序" name="sort" rules={[{ type: 'number', message: '排序必须为数字' }]}>
          <InputNumber style={{ width: '100%' }} placeholder="升序排序，0 排在前" />
        </Form.Item>
        <Form.Item
          label="是否默认"
          name="isDefault"
          valuePropName="checked"
          getValueFromEvent={(v) => !!v}
          getValueProps={(v) => ({ checked: !!v })}
        >
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
        <Form.Item
          label="启用"
          name="is_enabled"
          valuePropName="checked"
          getValueFromEvent={(v) => !!v}
          getValueProps={(v) => ({ checked: v !== false })}
        >
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={3} placeholder="选填" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default DictDataDrawer;