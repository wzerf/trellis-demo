import type { AppRouteObject } from '@/core/router/types';
import React from 'react';
import DashboardPage from '@/pages/app/dashboard';

export const dashboardRoutes: AppRouteObject[] = [
  {
    name: 'dashboard',
    path: 'dashboard', // 相对路径，会自动拼接到父路由 '/'
    element: <DashboardPage />,
    meta: {
      title: 'routes:dashboard',
      icon: 'lucide:layout-dashboard',
      order: 1,
      hideInMenu: false,
    },
  },
];

export default dashboardRoutes;
