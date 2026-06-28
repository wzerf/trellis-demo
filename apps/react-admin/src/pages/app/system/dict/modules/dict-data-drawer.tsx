import { useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
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
import {
  getCurrentPlatform,
  PLATFORM_OPTIONS,
  TAG_TYPE_OPTIONS,
} from './shared';

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
  platform?: string;
  /** 是否开启预设样式（默认开；编辑回显由 row.tag_type 决定） */
  usePresetStyle?: boolean;
  /** 预设样式标识；关闭时强制 'default' */
  tagType?: string;
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
  // 抽屉内任意字段变化都触发预览（label + tagType 同时影响）
  const watchedLabel = Form.useWatch('label', form);
  const watchedTagType = Form.useWatch('tagType', form);
  const watchedUsePreset = Form.useWatch('usePresetStyle', form);
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
  // - 新建：用 defaultTypeId 回显所属类型，platform 默认当前前端平台，其他字段给个合理的初始值
  const buildFormValues = (
    source: DictData | null,
    initialTypeId?: number,
  ): FormValues => {
    if (source) {
      const hasPreset = source.tag_type && source.tag_type !== 'default';
      return {
        typeId: source.type_id,
        value: source.value,
        label: source.label,
        sort: source.sort,
        isDefault: source.is_default === 1,
        platform: source.platform,
        usePresetStyle: hasPreset,
        tagType: source.tag_type,
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
      platform: getCurrentPlatform(),
      usePresetStyle: true,
      tagType: 'primary',
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
    const finalTagType = values.usePresetStyle
      ? values.tagType || 'primary'
      : 'default';
    if (isEdit) {
      updateMut.mutate({
        id: row.id,
        value: values.value,
        label: values.label,
        sort: values.sort ?? 0,
        is_default: values.isDefault ? 1 : 0,
        platform: values.platform ?? getCurrentPlatform(),
        tag_type: finalTagType,
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
        platform: values.platform ?? getCurrentPlatform(),
        tag_type: finalTagType,
        is_enabled: values.is_enabled ? 1 : 0,
        remark: values.remark ?? '',
      };
      createMut.mutate(body);
    }
  };

  // 实时预览：根据当前 usePresetStyle / tagType / label 渲染 Tag
  const previewColor = watchedUsePreset ? watchedTagType || 'primary' : 'default';
  const previewText = watchedLabel || '示例标签';

  return (
    <Drawer
      title={isEdit ? '编辑字典项' : '新建字典项'}
      open={open}
      onClose={onClose}
      size={640}
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
        {/* ============ 基础信息 ============ */}
        <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
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
            </Col>
            <Col span={12}>
              <Form.Item
                label="字典值"
                name="value"
                rules={[
                  { required: true, message: '请输入字典值' },
                  { max: 64 },
                ]}
              >
                <Input placeholder="例如 Y / N / 0 / 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="字典标签"
                name="label"
                rules={[
                  { required: true, message: '请输入字典标签' },
                  { max: 128 },
                ]}
              >
                <Input placeholder="例如 是 / 否 / 启用" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ============ 样式设置 ============ */}
        <Card size="small" title="样式设置" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Form.Item
                label="开启预设样式"
                name="usePresetStyle"
                valuePropName="checked"
                getValueFromEvent={(v) => !!v}
                getValueProps={(v) => ({ checked: v !== false })}
                style={{ marginBottom: 0 }}
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            {watchedUsePreset ? (
              <Col span={10}>
                <Form.Item
                  label="预设样式"
                  name="tagType"
                  rules={[{ required: true, message: '请选择预设样式' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    placeholder="请选择预设样式"
                    options={TAG_TYPE_OPTIONS}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
            ) : null}
            <Col span={watchedUsePreset ? 6 : 16}>
              <div
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                预览
              </div>
              <Tag color={previewColor} style={{ marginInlineEnd: 0 }}>
                {previewText}
              </Tag>
            </Col>
          </Row>
        </Card>

        {/* ============ 其他属性 ============ */}
        <Card size="small" title="其他属性" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="排序"
                name="sort"
                rules={[{ type: 'number', message: '排序必须为数字' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="升序排序，0 排在前"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="归属平台" name="platform">
                <Select
                  options={PLATFORM_OPTIONS}
                  placeholder="请选择归属平台"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="是否默认"
                name="isDefault"
                valuePropName="checked"
                getValueFromEvent={(v) => !!v}
                getValueProps={(v) => ({ checked: !!v })}
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="启用"
                name="is_enabled"
                valuePropName="checked"
                getValueFromEvent={(v) => !!v}
                getValueProps={(v) => ({ checked: v !== false })}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>
    </Drawer>
  );
};

export default DictDataDrawer;