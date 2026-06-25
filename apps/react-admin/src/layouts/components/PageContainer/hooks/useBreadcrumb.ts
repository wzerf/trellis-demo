import { useMemo } from 'react';
import React from 'react';
import { useMatches, useNavigate } from 'react-router-dom';
import { getIconFromName } from '@/layouts/MainLayout/utils/iconResolver';

import { useI18n } from '@/core/i18n';
import type { AppRoute } from '@/core/router/types';
import type { BreadcrumbItem } from '../types';

interface UseBreadcrumbOptions {
  /** 手动传入的面包屑（优先级最高） */
  manual?: BreadcrumbItem[] | false;

  /** 当前路由对象（用于获取 meta 信息） */
  route?: Partial<AppRoute> | null;

  /** 是否显示首页图标 */
  showHomeIcon?: boolean;

  /** 是否显示面包屑图标 */
  showIcon?: boolean;
}

export const useBreadcrumb = ({
  manual,
  route,
  showHomeIcon = true,
  showIcon = true,
}: UseBreadcrumbOptions): BreadcrumbItem[] | false => {
  const navigate = useNavigate();
  const matches = useMatches();
  const { t } = useI18n('common');

  // 类型定义：为 handle 扩展类型
  type MatchWithHandle = {
    pathname: string;
    params: { [key: string]: string | undefined };
    pathnameBase: string;
    handle?: {
      title?: string;
      icon?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  const items = useMemo<BreadcrumbItem[]>(() => {
    // 手动传入优先（false 已在 hook 外处理）
    if (manual && manual.length > 0) return manual;

    const typedMatches = matches as MatchWithHandle[];

    // 过滤出有标题的匹配项
    return typedMatches
      .filter((match: MatchWithHandle) => match.handle?.title || match.pathname === '/')
      .map((match: MatchWithHandle, index: number, arr: MatchWithHandle[]) => {
        const isLast = index === arr.length - 1;
        const title = match.handle?.title || route?.meta?.title || t('pageContainer.defaultTitle');

        // 将图标字符串转换为 React 组件（支持 Iconify 和 Ant Design）
        let icon: React.ReactNode = undefined;
        if (showIcon && match.handle?.icon) {
          icon = getIconFromName(match.handle.icon);
        }

        return {
          path: match.pathname,
          breadcrumbName: title,
          icon, // 添加图标
          // 最后一项不可点击（当前页）
          onClick: !isLast && match.pathname ? () => navigate(match.pathname) : undefined,
        };
      });
  }, [matches, route?.meta?.title, navigate, showIcon, manual, t]);

  // 手动传入 false 表示强制不显示
  if (manual === false) return false;

  // 始终在开头添加首页（如果 showHomeIcon 为 true）
  if (showHomeIcon) {
    items.unshift({
      path: '/',
      breadcrumbName: t('home'),
      icon: showIcon ? getIconFromName('lucide:home') : undefined,
      onClick: () => navigate('/'),
    });
  }

  return items;
};