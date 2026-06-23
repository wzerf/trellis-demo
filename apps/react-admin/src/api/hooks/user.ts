import {
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { queryClient } from '@/core';
import {
  createUserApi,
  deleteUserApi,
  listUsersApi,
  updateUserApi,
} from '@/api/rest/user';
import type {
  CreateUserRequest,
  PageResult,
  UpdateUserRequest,
  UserListItem,
  UserListQuery,
} from '@/api/rest/types';

// =========================================
// 列表查询
// =========================================
export function useListUsers(
  query: UserListQuery,
  options?: UseQueryOptions<PageResult<UserListItem>, Error>,
) {
  return useQuery({
    queryKey: ['listUsers', query],
    queryFn: () => listUsersApi(query),
    ...options,
  });
}

export async function fetchListUsers(query: UserListQuery) {
  return queryClient.fetchQuery({
    queryKey: ['listUsers', query],
    queryFn: () => listUsersApi(query),
    retry: 0,
  });
}

// =========================================
// 新建
// =========================================
export function useCreateUser(
  options?: UseMutationOptions<UserListItem, Error, CreateUserRequest>,
) {
  return useMutation({
    mutationFn: (data) => createUserApi(data),
    ...options,
  });
}

// =========================================
// 更新
// =========================================
export function useUpdateUser(
  options?: UseMutationOptions<UserListItem, Error, UpdateUserRequest>,
) {
  return useMutation({
    mutationFn: (req) => updateUserApi(req),
    ...options,
  });
}

// =========================================
// 删除
// =========================================
export function useDeleteUser(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  return useMutation({
    mutationFn: (id) => deleteUserApi(id),
    ...options,
  });
}
