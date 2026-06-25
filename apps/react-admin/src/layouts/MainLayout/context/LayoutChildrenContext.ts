import { createContext, useContext } from 'react';
import type { AppRouteObject } from '@/core/router/types';

/**
 * 主布局子路由上下文
 *
 * 作用：把 `AppRouter` 中合并好的 `allRoutes` 里的 `path: '/'` 容器
 * children 传给 `MainLayout`，用于生成侧边栏菜单。
 *
 * 之所以需要 Context：
 * `MainLayout` 在 `static.tsx` 中被使用，而 `static.tsx` 又是
 * `routes-config.tsx` 中 `allRoutes` 的依赖。
 * 若 `MainLayout` 直接 import `routes-config`，会形成循环依赖
 * （`static.tsx` → `MainLayout` → `routes-config` → `static.tsx`），
 * 触发 "Cannot access 'MainLayout' before initialization"。
 *
 * 通过 Context，`MainLayout` 不再 import `routes-config`，
 * 数据由 `AppRouter` 在路由初始化完成后注入。
 */
export const LayoutChildrenContext = createContext<AppRouteObject[]>([]);

export const LayoutChildrenProvider = LayoutChildrenContext.Provider;

/** 在 `MainLayout` 内部消费主布局子路由 */
export const useLayoutChildren = (): AppRouteObject[] => useContext(LayoutChildrenContext);
