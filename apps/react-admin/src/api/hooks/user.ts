import {
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  type identityservicev1_User,
  type identityservicev1_ListUserResponse,
  type identityservicev1_GetUserRequest,
  type identityservicev1_UserExistsRequest,
  type identityservicev1_EditUserPasswordRequest,
  type identityservicev1_UserExistsResponse,
} from '@/api/generated/admin/service/v1';
import { makeUpdateMask, type PaginationQuery } from '@/core/transport/rest';
import { apiClient } from '@/api/client';
import { queryClient } from '@/core';

/**
 * 获取用户列表（剥离不需要的分页参数）
 */
function listUsers(query: PaginationQuery) {
  const params = query.toRawParams();
  return apiClient.userService.List({
    ...params,
    sorting: undefined,
    offset: undefined,
    limit: undefined,
    token: undefined,
    filter: undefined,
    filterExpr: undefined,
  });
}

// ==============================
// 获取用户列表
// ==============================
export function useListUsers(
  query: PaginationQuery,
  options?: UseQueryOptions<identityservicev1_ListUserResponse, Error>,
) {
  return useQuery({
    queryKey: ['listUsers', query],
    queryFn: () => listUsers(query),
    ...options,
  });
}

// ==============================================
// 获取用户列表 【给 Store / 外部调用】不带 Hook 的方法
// ==============================================
export async function fetchListUsers(params: PaginationQuery) {
  return queryClient.fetchQuery({
    queryKey: ['listUsers', params],
    queryFn: () => listUsers(params),
    retry: 0,
  });
}

// ==============================
// 获取单个用户
// ==============================
export function useGetUser(
  req: identityservicev1_GetUserRequest,
  options?: UseQueryOptions<identityservicev1_User, Error>,
) {
  return useQuery({
    queryKey: ['getUser', req],
    queryFn: () => apiClient.userService.Get(req),
    ...options,
  });
}

// ==============================================
// 获取单个用户 【给 Store / 外部调用】不带 Hook 的方法
// ==============================================
export async function fetchUser(params: identityservicev1_GetUserRequest) {
  return queryClient.fetchQuery({
    queryKey: ['getUser', params],
    queryFn: () => apiClient.userService.Get(params),
    retry: 0,
  });
}

// ==============================
// 创建用户
// ==============================
export function useCreateUser(
  options?: UseMutationOptions<{}, Error, { data: identityservicev1_User; password?: string }>,
) {
  return useMutation({
    mutationFn: ({ data, password }) => apiClient.userService.Create({ data, password }),
    ...options,
  });
}

// ==============================
// 删除用户
// ==============================
export function useDeleteUser(options?: UseMutationOptions<{}, Error, number>) {
  return useMutation({
    mutationFn: (id) => apiClient.userService.Delete({ id }),
    ...options,
  });
}

// ==============================
// 更新用户
// ==============================
export function useUpdateUser(
  options?: UseMutationOptions<{}, Error, { id: number; values: Record<string, any> }>,
) {
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Record<string, any> }) =>
      apiClient.userService.Update({
        id,
        data: { ...values } as any,
        updateMask: makeUpdateMask(Object.keys(values ?? {})),
      }),
    ...options,
  });
}

// ==============================
// 检查用户是否存在
// ==============================
export function useUserExists(
  options?: UseMutationOptions<
    identityservicev1_UserExistsResponse,
    Error,
    identityservicev1_UserExistsRequest
  >,
) {
  return useMutation({
    mutationFn: (data) => apiClient.userService.UserExists(data),
    ...options,
  });
}

// ==============================
// 修改用户密码（管理员）
// ==============================
export function useEditUserPassword(
  options?: UseMutationOptions<{}, Error, identityservicev1_EditUserPasswordRequest>,
) {
  return useMutation({
    mutationFn: (data) => apiClient.userService.EditUserPassword(data),
    ...options,
  });
}
