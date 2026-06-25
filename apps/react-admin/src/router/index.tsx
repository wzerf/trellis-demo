import { useState, useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';

import { createAccessibleRouter } from '@/core/router/factory';
import { useAuthStore } from '@/stores';
import { useAuth } from '@/hooks/useAuth';
import { getAccessStatic } from '@/core/access';
import { fetchAllDictEntries } from '@/hooks/useDictCache';
import { usePreferencesStore } from '@/core/preferences/store';
import { getAllMenusApi } from '@/api/rest/menu';

import { Forbidden } from '@/pages/core/error';
import type { ComponentRecordType } from '@/core/router';
import MainLayout from '@/layouts/MainLayout';
import { LayoutChildrenProvider } from '@/layouts/MainLayout/context/LayoutChildrenContext';
import { AuthGuard } from '@/router/guards';

import {
  allRoutes,
  filterMenusByPageMap,
  pageMap,
} from './routes-config';

// 布局组件映射（后端 component 字段 → React 组件）
// 后端模式：BasicLayout 需要包裹 AuthGuard（前端模式已在 staticRoutes 中包裹）
const AuthenticatedLayout = () => (
  <AuthGuard>
    <MainLayout />
  </AuthGuard>
);

const layoutMap: ComponentRecordType = {
  BasicLayout: AuthenticatedLayout,
};

// 提取主布局容器 (path: '/') 的 children，避免 MainLayout 自身依赖 routes-config 形成循环
const layoutChildren = allRoutes.find((route) => route.path === '/' && route.children)?.children ?? [];

export const AppRouter = () => {
  const [router, setRouter] = useState<Awaited<ReturnType<typeof createAccessibleRouter>> | null>(null);
  const [loading, setLoading] = useState(true);

  const accessToken = useAuthStore((s) => s.accessToken);
  const accessMode = usePreferencesStore((s) => s.preferences.app.accessMode);
  // getUserPermissionCodes 内部用 useCallback 稳定，但 effect 不应依赖它
  // （auth 流程触发会调它，已在 useAuthStore 中反映）
  const { getUserPermissionCodes } = useAuth();
  const getUserPermissionCodesRef = useRef(getUserPermissionCodes);
  useEffect(() => {
    getUserPermissionCodesRef.current = getUserPermissionCodes;
  }, [getUserPermissionCodes]);

  const isAuthenticated = !!accessToken;

  useEffect(() => {
    let cancelled = false;

    const initRouter = async () => {
      setLoading(true);

      try {
        // ========== 已认证时的初始化流程 ==========
        // 对齐 Vue 版 setupAccessGuard：权限码获取 + 字典预加载
        if (isAuthenticated) {
          try {
            // 1. 获取用户权限码（角色 + 权限码，首次会调 API）
            await getUserPermissionCodesRef.current();

            // 2. 预加载字典数据（部分页面依赖字典，未预加载会导致闪烁）
            await fetchAllDictEntries();
          } catch (authErr) {
            // 认证失败（token 过期/无效）：forceLogout 已在拦截器中被调用
            // 清除 userStore 防止脏数据
            console.warn('Auth initialization failed, will redirect to login:', authErr);
            // forceLogout 已在拦截器中处理，此处清除 userStore
            const { useUserStore } = await import('@/stores');
            useUserStore.getState().$reset();

            if (cancelled) return; // 已过期，不继续创建路由
          }
        }

        // await 之后，通过 useAccess 获取最新合并权限（角色码 + 权限码）
        const freshPermissions = getAccessStatic().getAllPermissions();

        // 无论认证是否成功，都生成路由（未认证时 permissions 为空，AuthGuard 会拦截）
        const appRouter = await createAccessibleRouter(accessMode, {
          routes: allRoutes,
          permissions: freshPermissions,
          forbiddenElement: <Forbidden />,
          fetchMenuListAsync: async () => {
            const items = await getAllMenusApi();
            return filterMenusByPageMap(items ?? []);
          },
          layoutMap,
          pageMap,
          autoInjectRedirect: true,
          autoSort: true,
        });

        if (!cancelled) {
          setRouter(appRouter);
        }
      } catch (err) {
        console.error('Router init failed:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initRouter();

    // cleanup：当 effect 重新触发时（isAuthenticated 变化），取消上一次 initRouter
    return () => {
      cancelled = true;
    };
    // 只依赖真正会触发初始化的字段。getUserPermissionCodes 走 ref，避免对象引用变化导致 effect 反复跑
  }, [isAuthenticated, accessMode]);

  if (loading || !router)
    return <Loading fullScreen text="初始化中" subText="正在加载路由配置..." />;

  return (
    <LayoutChildrenProvider value={layoutChildren}>
      <RouterProvider router={router} />
    </LayoutChildrenProvider>
  );
};