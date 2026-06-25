/**
 * 认证相关 Hook
 * 统一封装登录/登出/用户信息/权限码等功能
 * 对齐 Vue 版 useAuth composable
 */
import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import { fetchUserInfo, fetchAccessCodes } from '@/api/hooks/auth';
import type { UserInfo } from '@/api/rest/types';

export function useAuth() {
  // 用 useCallback 稳定方法引用，避免下游 useEffect 把整个对象作为依赖时反复触发
  const getUserInfo = useCallback(async (): Promise<UserInfo | null> => {
    try {
      return await fetchUserInfo();
    } catch (error) {
      console.error('getUserInfo failed:', error);
      return null;
    }
  }, []);

  const getAccessCodes = useCallback(async (): Promise<string[]> => {
    return fetchAccessCodes();
  }, []);

  const getUserPermissionCodes = useCallback(async (): Promise<{ roles: string[]; codes: string[] } | false> => {
    const userStore = useUserStore.getState();
    const { userRoles, accessCodes } = userStore;

    if (userRoles.length === 0 && accessCodes.length === 0) {
      const [userInfoResult, accessCodeResult] = await Promise.all([
        getUserInfo(),
        getAccessCodes(),
      ]);

      if (!userInfoResult || !accessCodeResult) {
        console.warn('getUserPermissionCodes: failed to fetch user info or access codes');
        return false;
      }

      // 同步 useAuthStore.userInfo（Header 等组件读这里）
      useAuthStore.getState().setUserInfo(userInfoResult);
      // 同步 useUserStore 的角色 / 权限码 / 租户
      const roles = userInfoResult.roles ?? [];
      userStore.setUserRoles(roles);
      userStore.setAccessCodes(accessCodeResult);
      userStore.setUserInfo({ roles, tenantId: userInfoResult.tenantId });
      return { roles, codes: accessCodeResult };
    }

    return { roles: userRoles, codes: accessCodes };
  }, [getUserInfo, getAccessCodes]);

  return useMemo(
    () => ({
      get loginLoading() {
        return useAuthStore.getState().loginLoading;
      },
      login: useAuthStore.getState().login,
      logout: useAuthStore.getState().logout,
      forceLogout: useAuthStore.getState().forceLogout,
      fetchUserInfo: getUserInfo,
      fetchAccessCodes: getAccessCodes,
      getUserPermissionCodes,
    }),
    [getUserInfo, getAccessCodes, getUserPermissionCodes],
  );
}
