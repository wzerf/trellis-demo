import type { AppRouteObject } from '../types';

/**
 * 展平模块导出（兼容 default / 具名导出）
 * 纯函数，无副作用，可单元测试
 */
export const extractRoutes = (module: unknown): AppRouteObject[] => {
  if (Array.isArray((module as { default?: unknown })?.default)) {
    return (module as { default: AppRouteObject[] }).default;
  }

  const namedExport = Object.values(module as Record<string, unknown>).find(
    (val) => Array.isArray(val) && val.length > 0,
  );

  return Array.isArray(namedExport) ? (namedExport as AppRouteObject[]) : [];
};

/**
 * 过滤无效路由（开发环境调试用）
 */
export const filterValidRoutes = (routes: AppRouteObject[]): AppRouteObject[] => {
  if (!import.meta.env.DEV) return routes;

  return routes.filter((route) => {
    if (!route.path) {
      console.warn(`[router] Route missing "path":`, route);
      return false;
    }
    if (!route.name && route.path !== '*') {
      console.warn(`[router] Route missing "name":`, route);
    }
    return true;
  });
};

/**
 * 根据权限过滤路由树
 */
export const filterRoutesByPermission = (
  routes: AppRouteObject[],
  permissions: string[],
): AppRouteObject[] => {
  return routes.reduce<AppRouteObject[]>((acc, route) => {
    // 检查当前路由权限
    const hasPerm = !route.meta?.authority?.length || route.meta.authority.some((code) => permissions.includes(code));
    if (!hasPerm && !route.meta?.menuVisibleWithForbidden) {
      return acc; // 无权限且不可见 = 过滤
    }

    // 递归处理子路由
    const filtered = { ...route };
    if (route.children?.length) {
      const childFiltered = filterRoutesByPermission(route.children, permissions);
      if (childFiltered.length > 0 || !route.meta?.hideChildrenInMenu) {
        filtered.children = childFiltered;
      }
    }

    acc.push(filtered);
    return acc;
  }, []);
};