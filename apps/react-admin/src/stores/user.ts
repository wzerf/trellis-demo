import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========== 状态定义 ==========
// userInfo 的唯一来源是 useAuthStore（精简后无重复）；
// 本 store 只承担角色码 + 权限码 + 租户信息。
export interface UserState {
  userRoles: string[];
  accessCodes: string[];
  tenantId: number | null;

  setUserInfo: (info: { roles?: string[]; tenantId?: number | string | null } | null) => void;
  setUserRoles: (roles: string[]) => void;
  setAccessCodes: (codes: string[]) => void;
  isTenantUser: () => boolean;
  $reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userRoles: [],
      accessCodes: [],
      tenantId: null,

      setUserInfo: (info) => {
        set({
          userRoles: info?.roles ?? [],
          tenantId:
            info?.tenantId !== undefined && info?.tenantId !== null
              ? Number(info.tenantId)
              : null,
        });
      },
      setUserRoles: (roles) => set({ userRoles: roles }),
      setAccessCodes: (codes) => set({ accessCodes: codes }),

      isTenantUser: () => {
        const { tenantId } = get();
        return tenantId !== null && tenantId !== undefined && tenantId > 0;
      },

      $reset: () => set({ userRoles: [], accessCodes: [], tenantId: null }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        // 持久化仅供调试；正常路径用 useAuthStore.userInfo
        userRoles: state.userRoles,
        accessCodes: state.accessCodes,
        tenantId: state.tenantId,
      }),
    },
  ),
);

