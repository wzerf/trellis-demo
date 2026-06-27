import {
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { queryClient } from '@/core';
import {
  createDictDataApi,
  deleteDictDataApi,
  listDictDataApi,
  updateDictDataApi,
} from '@/api/rest/dict-data';
import {
  createDictTypeApi,
  deleteDictTypeApi,
  getDictTypeApi,
  listAllDictTypeApi,
  listDictTypeApi,
  updateDictTypeApi,
} from '@/api/rest/dict-type';
import type {
  CreateDictDataRequest,
  CreateDictTypeRequest,
  DictData,
  DictDataQuery,
  DictType,
  DictTypeQuery,
  UpdateDictDataRequest,
  UpdateDictTypeRequest,
} from '@/api/rest/types';

/**
 * 当前前端平台标识（VITE_APP_PLATFORM）。
 * 与 backend mock 的 ?platform= 过滤对齐：dict_data.list 默认只返回
 * platform = 'general' 或 platform = currentPlatform 的项。
 * 缺省 'general'（向后兼容未配置的环境）。
 */
const CURRENT_PLATFORM: string =
  (import.meta.env.VITE_APP_PLATFORM as string | undefined) || 'general';

// =========================================================
// 字典类型（dict-type）
// =========================================================

export function useListDictType(
  query: DictTypeQuery = {},
  options?: UseQueryOptions<{ items: DictType[]; total: number }, Error>,
) {
  return useQuery({
    queryKey: ['listDictType', query],
    queryFn: () => listDictTypeApi(query),
    ...options,
  });
}

export async function fetchListDictTypes(query: DictTypeQuery = {}) {
  return queryClient.fetchQuery({
    queryKey: ['listDictType', query],
    queryFn: () => listDictTypeApi(query),
    retry: 0,
  });
}

export function useListAllDictType(
  params?: { status?: 0 | 1 },
  options?: UseQueryOptions<DictType[], Error>,
) {
  return useQuery({
    queryKey: ['listAllDictType', params],
    queryFn: () => listAllDictTypeApi(params),
    ...options,
  });
}

export function useGetDictType(
  id: number | null | undefined,
  options?: UseQueryOptions<DictType, Error>,
) {
  return useQuery({
    queryKey: ['getDictType', id],
    queryFn: () => getDictTypeApi(id as number),
    enabled: typeof id === 'number',
    ...options,
  });
}

export function useCreateDictType(
  options?: UseMutationOptions<DictType, Error, CreateDictTypeRequest>,
) {
  return useMutation({
    mutationFn: (body) => createDictTypeApi(body),
    ...options,
  });
}

export function useUpdateDictType(
  options?: UseMutationOptions<DictType, Error, UpdateDictTypeRequest>,
) {
  return useMutation({
    mutationFn: (req) => updateDictTypeApi(req),
    ...options,
  });
}

export function useDeleteDictType(
  options?: UseMutationOptions<unknown, Error, number>,
) {
  return useMutation({
    mutationFn: (id) => deleteDictTypeApi(id),
    ...options,
  });
}

// =========================================================
// 字典数据（dict-data）
// =========================================================

export function useListDictData(
  query: DictDataQuery = {},
  options?: Omit<UseQueryOptions<{ items: DictData[]; total: number }, Error>, 'queryKey' | 'queryFn'>,
) {
  // 自动注入 platform：调用方未传时使用 currentPlatform。
  // 注意：queryKey 用最终合并后的 query，避免缓存命中失败。
  const merged: DictDataQuery = { platform: CURRENT_PLATFORM, ...query };
  return useQuery({
    queryKey: ['listDictData', merged],
    queryFn: () => listDictDataApi(merged),
    ...options,
  });
}

export async function fetchListDictEntries(query: DictDataQuery = {}) {
  const merged: DictDataQuery = { platform: CURRENT_PLATFORM, ...query };
  return queryClient.fetchQuery({
    queryKey: ['listDictData', merged],
    queryFn: () => listDictDataApi(merged),
    retry: 0,
  });
}

export function useCreateDictData(
  options?: UseMutationOptions<DictData, Error, CreateDictDataRequest>,
) {
  return useMutation({
    mutationFn: (body) => createDictDataApi(body),
    ...options,
  });
}

export function useUpdateDictData(
  options?: UseMutationOptions<DictData, Error, UpdateDictDataRequest>,
) {
  return useMutation({
    mutationFn: (req) => updateDictDataApi(req),
    ...options,
  });
}

export function useDeleteDictData(
  options?: UseMutationOptions<unknown, Error, number>,
) {
  return useMutation({
    mutationFn: (id) => deleteDictDataApi(id),
    ...options,
  });
}