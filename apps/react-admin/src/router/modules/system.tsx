import type { AppRouteObject } from '@/core/router/types';
import UserPage from '@/pages/app/system/user';
import DictPage from '@/pages/app/system/dict';

/**
 * 系统管理路由配置
 * user 与 dict（字典管理）已上线；其余模块保留目录结构以便后续补充。
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
      {
        name: 'dict',
        path: 'dict',
        element: <DictPage />,
        meta: {
          title: 'routes:dict',
          icon: 'lucide:book-marked',
          order: 2,
        },
      },
    ],
  },
];

export default systemRoutes;