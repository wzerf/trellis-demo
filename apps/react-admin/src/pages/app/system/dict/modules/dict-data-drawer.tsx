import { useEffect, useMemo } from 'react';
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
  useListAllDictType,
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
  // 兜底加载：父组件 typeOptions 还没就绪就打开抽屉时，自己拉一次确保
  // Select 拿得到匹配项，否则 setFieldsValue 设的 typeId 会显示不出来
  const allTypesQuery = useListAllDictType(
    { status: 1 },
    { enabled: open && typeOptions.length === 0 },
  );
  const effectiveTypeOptions = useMemo(() => {
    if (typeOptions.length > 0) return typeOptions;
    return (allTypesQuery.data ?? []).map((t) => ({
      label: `${t.name}（${t.code}）`,
      value: t.id,
    }));
  }, [typeOptions, allTypesQuery.data]);

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

  // 根据当前模式（编辑/新建）构造 form values。
  // - 编辑：用 row 各字段回显，注意 is_default/is_enabled 是 0/1，转成 boolean 给 Switch
  // - 新建：用 defaultTypeId 回显所属类型，其他字段给个合理的初始值
  const buildFormValues = (
    source: DictData | null,
    initialTypeId?: number,
  ): FormValues => {
    if (source) {
      return {
        typeId: source.type_id,
        value: source.value,
        label: source.label,
        sort: source.sort,
        isDefault: source.is_default === 1,
        is_enabled: source.is_enabled === 1,
        remark: source.remark,
      };
    }
    return {
      typeId: initialTypeId as FormValues['typeId'],
      value: '',
      label: '',
      sort: 0,
      isDefault: false,
      is_enabled: true,
      remark: '',
    };
  };

  useEffect(() => {
    if (!open) return;
    // 新建模式必须等 typeOptions 就绪再回显，否则 Select 拿不到匹配项
    if (!row && effectiveTypeOptions.length === 0) return;
    // 抽屉首次打开时 destroyOnClose 会卸载 Form，下次重新挂载时
    // Select 等子项还没完成注册，立即 setFieldsValue 会丢。
    // 延后到下一帧再回显，避免 typeId 字段首次不显示。
    const apply = () =>
      form.setFieldsValue(buildFormValues(row, defaultTypeId));
    apply();
    const timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, [open, row, defaultTypeId, effectiveTypeOptions, form]);

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
            options={effectiveTypeOptions}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="字典值"
          name="value"
          rules={[{ required: true, message: '请输入字典值' }, { max: 64 }]}
        >
          <Input placeholder="例如 Y / N / 0 / 1" />
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
