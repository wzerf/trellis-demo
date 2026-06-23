import type { AppRouteObject } from '@/core/router/types';
import UserPage from '@/pages/app/system/user';
import React from 'react';

/**
 * 系统管理路由配置（精简版）
 * 仅保留用户管理；其它页面（dict/files/tasks/login-policies/languages）保留目录但路由不再注册。
 */
export const systemRoutes: AppRouteObject[] = [
  {
    name: 'system',
    path: 'system',
    meta: {
      title: 'routes:system',
      icon: 'lucide:settings',
      order: 2005,
      keepAlive: true,
    },
    children: [
      {
        name: 'user',
        path: 'user',
        element: <UserPage />,
        meta: {
          title: 'routes:users',
          icon: 'lucide:user-cog',
          order: 1,
        },
      },
    ],
  },
];

export default systemRoutes;

