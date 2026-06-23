import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { queryClient } from '@/core';
import {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  refreshTokenApi,
} from '@/api/rest/auth';
import type { AccessCode, LoginRequest, LoginResponse, UserInfo } from '@/api/rest/types';

// =========================================
// 登录 (Mutation)
// =========================================
export function useLogin(
  options?: UseMutationOptions<LoginResponse, Error, LoginRequest>,
) {
  return useMutation({
    mutationFn: (req) => loginApi(req),
    ...options,
  });
}

// =========================================
// 登出 (Mutation)
// =========================================
export function useLogout(options?: UseMutationOptions<unknown, Error, void>) {
  return useMutation({
    mutationFn: () => logoutApi(),
    ...options,
  });
}

// =========================================
// 刷新 Token (Mutation)
// =========================================
export function useRefreshToken(
  options?: UseMutationOptions<{ accessToken: string }, Error, void>,
) {
  return useMutation({
    mutationFn: () => refreshTokenApi(),
    ...options,
  });
}

// =========================================
// 当前用户 (Query)
// =========================================
export function useUserInfo(options?: UseQueryOptions<UserInfo, Error>) {
  return useQuery({
    queryKey: ['userInfo'],
    queryFn: () => getUserInfoApi(),
    ...options,
  });
}

export async function fetchUserInfo() {
  return queryClient.fetchQuery({
    queryKey: ['userInfo'],
    queryFn: () => getUserInfoApi(),
    retry: 0,
  });
}

// =========================================
// 权限码 (Query)
// =========================================
export function useAccessCodes(options?: UseQueryOptions<AccessCode[], Error>) {
  return useQuery({
    queryKey: ['accessCodes'],
    queryFn: () => getAccessCodesApi(),
    ...options,
  });
}

export async function fetchAccessCodes() {
  return queryClient.fetchQuery({
    queryKey: ['accessCodes'],
    queryFn: () => getAccessCodesApi(),
    retry: 0,
  });
}
