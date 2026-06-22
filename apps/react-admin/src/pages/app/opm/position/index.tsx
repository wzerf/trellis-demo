import { useRef, useState } from 'react';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Popconfirm, Tag, App } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { identityservicev1_Position as Position } from '@/api/generated/admin/service/v1';
import { PaginationQuery } from '@/core';
import { fetchListPositions, useDeletePosition } from '@/api/hooks/position';
import { useProTableScrollY } from '@/hooks/useProTableScrollY';
import ContentContainer from '@/layouts/components/PageContainer/ContentContainer';
import {
  getStatusMap,
  getStatusOptions,
  getPositionTypeMap,
  getPositionTypeOptions,
} from './constants';
import PositionDrawer from './components/PositionDrawer';

/**
 * 职位管理页面
 */
const PositionManagement = () => {
  const { t } = useTranslation('position');
  const actionRef = useRef<ActionType>(null);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const tableScrollY = useProTableScrollY(containerRef);

  // Drawer 状态管理
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedPosition, setSelectedPosition] = useState<Position | undefined>();

  const statusMap = getStatusMap(t);
  const positionTypeMap = getPositionTypeMap(t);

  // 删除操作
  const deleteMutation = useDeletePosition({
    onSuccess: () => {
      message.success(t('deleteSuccess'));
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['listPositions'] });
    },
    onError: (error: Error) => {
      message.error(error.message || t('deleteFailed'));
    },
  });

  // 列配置
  const columns: ProColumns<Position>[] = [
    {
      title: t('name'),
      dataIndex: 'name',
    },
    {
      title: t('code'),
      dataIndex: 'code',
    },
    {
      title: t('type'),
      dataIndex: 'type',
      width: 95,
      valueType: 'select',
      fieldProps: {
        options: getPositionTypeOptions(t),
      },
      render: (_, record) => {
        const type = record.type as keyof typeof positionTypeMap;
        const config = positionTypeMap[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('description'),
      dataIndex: 'description',
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('orgUnitName'),
      dataIndex: 'orgUnitName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('headcount'),
      dataIndex: 'headcount',
      width: 80,
      hideInSearch: true,
    },
    {
      title: t('status'),
      dataIndex: 'status',
      width: 95,
      valueType: 'select',
      fieldProps: {
        options: getStatusOptions(t),
      },
      render: (_, record) => {
        const status = record.status as keyof typeof statusMap;
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('sortOrder'),
      dataIndex: 'sortOrder',
      width: 70,
      hideInSearch: true,
    },
    {
      title: t('createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('remark'),
      dataIndex: 'remark',
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('action'),
      valueType: 'option',
      width: 90,
      fixed: 'right',
      render: (_, record) => [
        <a
          key="edit"
          onClick={() => {
            setDrawerMode('edit');
            setSelectedPosition(record);
            setDrawerOpen(true);
          }}
        >
          <EditOutlined />
        </a>,
        <Popconfirm
          key="delete"
          title={t('deleteConfirmTitle')}
          description={t('deleteConfirmDesc', { moduleName: t('moduleName') })}
          onConfirm={() => record.id && deleteMutation.mutate({ id: record.id })}
          okText={t('common:button.ok')}
          cancelText={t('common:button.cancel')}
        >
          <a style={{ color: '#ff4d4f' }}><DeleteOutlined /></a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ContentContainer heightMode="fixed" padding="16px" bottomMargin={0}>
        <div ref={containerRef} className="page-container-content">
          <ProTable<Position>
            actionRef={actionRef}
            columns={columns}
            request={async (params, _sorter, _filter) => {
              try {
                const query = new PaginationQuery({
                  paging: {
                    page: params.current || 1,
                    pageSize: params.pageSize || 20,
                  },
                  formValues: Object.fromEntries(
                    Object.entries(params).filter(
                      ([key]) => !['current', 'pageSize'].includes(key),
                    ),
                  ),
                });

                const response = await fetchListPositions(query);

                return {
                  data: response.items || [],
                  total: response.total || 0,
                  success: true,
                };
              } catch (error: any) {
                message.error(error.message || t('fetchFailed'));
                return { data: [], total: 0, success: false };
              }
            }}
            rowKey="id"
            search={{
              labelWidth: 'auto',
              defaultCollapsed: false,
            }}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
            }}
            toolBarRender={() => [
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setDrawerMode('create');
                  setSelectedPosition(undefined);
                  setDrawerOpen(true);
                }}
              >
                {t('create')}
              </Button>,
            ]}
            options={{
              density: true,
              fullScreen: true,
              setting: true,
              reload: true,
            }}
            size="middle"
            bordered
            cardBordered={false}
            scroll={{ y: tableScrollY, x: 1100 }}
          />
        </div>
      </ContentContainer>

      {/* 职位编辑/创建 Drawer */}
      <PositionDrawer
        open={drawerOpen}
        mode={drawerMode}
        data={selectedPosition}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedPosition(undefined);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />
    </>
  );
};

export default PositionManagement;
