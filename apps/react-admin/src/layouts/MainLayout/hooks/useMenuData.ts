import { useMemo } from 'react';
import type { AppRouteObject } from '@/core/router/types';
import { transformRoutesToMenu } from '@/core/router/utils/menu';

interface UseMenuDataOptions {
  /**
   * 主布局的子路由。
   * 通常为 `allRoutes` 中 `path: '/'` 路由的 `children`，
   * 已在 `router/index.tsx` 阶段完成与 `businessRoutes` 的合并。
   * 为避免循环依赖，调用方需自行提供，而非由本 hook 直接读取 `routes-config`。
   */
  layoutChildren?: AppRouteObject[];
  /** 动态路由（后端模式） */
  dynamicRoutes?: AppRouteObject[];
  /** 权限列表 */
  permissions: string[];
}

export const useMenuData = ({
  layoutChildren = [],
  dynamicRoutes,
  permissions,
}: UseMenuDataOptions) => {
  // 优先使用动态路由（后端模式），否则用主布局的子路由
  const routes = useMemo(() => {
    if (dynamicRoutes?.length) {
      return dynamicRoutes;
    }
    return layoutChildren;
  }, [dynamicRoutes, layoutChildren]);

  // 转换路由 → 菜单
  // 说明：语言切换时上层组件会重新渲染，无需在此处显式依赖 i18n.language
  return useMemo(() => {
    return transformRoutesToMenu(routes, permissions);
  }, [routes, permissions]);
};
