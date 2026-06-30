import {
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';
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

// =========================================================
// 字典查表 hook（dict-lookups）
// =========================================================
//
// 设计原则：fallback 由 hook 层承担，应用层不应再写 `?? '启用'` / `?? 'success'`
// 这类散落的兜底表达式。新增 fallback 类型时改本文件即可，不扩散到业务页。
//
// 与 useListDictData 的区别：
// - useListDictData  → 薄 query wrapper,只返回原始 items,无任何 fallback
// - useDictLookups   → 在 useListDictData 之上叠加 platform-preferred 命中、
//                       fallback label / tagType、ProTable 友好的 valueEnum

/** DictLookups 返回类型。React 端用 plain object（useMemo 已 cache）。 */
export interface DictLookups {
  /** 把 isEnabled 0/1 翻译成 dict label;命中失败返回 '启用' / '禁用' */
  lookupSwitchLabel: (n: 0 | 1 | number) => string;
  /** 返回 dict 的 tagType;命中失败按 n 走 'success' / 'default'。不预过滤白名单。 */
  lookupSwitchTagType: (n: 0 | 1 | number) => string | undefined;
  /** 把 platform code 翻译成 dict label;命中失败返回原 platform（p 未传返回 '-'） */
  lookupPlatformLabel: (platform: string | undefined) => string;
  /** 返回 dict 的 tagType;命中失败返回 undefined */
  lookupPlatformTagType: (platform: string | undefined) => string | undefined;
  /** ProTable status 列 valueEnum（text = label） */
  switchValueEnum: Record<0 | 1, { text: string }>;
  /** 归属平台列 valueEnum；dict 命中用 dict label，否则用 platformLabels */
  platformValueEnum: Record<string, { text: string }>;
  /** 字典是否已至少拉过 1 次（用于 platformValueEnum 兜底策略判断） */
  loaded: boolean;
}

export interface UseDictLookupsOptions {
  /** 要拉的字典类型；默认 ['sys_switch_status', 'sys_platform'] */
  typeCodes?: string[];
  /** 是否包含 general 平台；默认 true */
  includeGeneral?: boolean;
  /** platform valueEnum 的兜底 label map，如 { general: '通用', 'react-admin': 'React Admin' } */
  platformLabels?: Record<string, string>;
}

const DEFAULT_TYPE_CODES = ['sys_switch_status', 'sys_platform'];
const SWITCH_LABEL_FALLBACK: Record<0 | 1, string> = { 1: '启用', 0: '禁用' };
const SWITCH_TAG_TYPE_FALLBACK: Record<0 | 1, string> = { 1: 'success', 0: 'default' };
const IS_ENABLED_KEY: Record<0 | 1, 'enabled' | 'disabled'> = {
  1: 'enabled',
  0: 'disabled',
};

function isEnabledKey(n: number): 'enabled' | 'disabled' {
  return IS_ENABLED_KEY[(n === 1 ? 1 : 0)];
}

/**
 * 多平台候选中选最优一条：当前平台优先 → tagType 非空优先 → 第一项。
 * 取代旧版 React `Map.set` 后写覆盖的隐式行为，匹配 mock 数据顺序假设。
 */
function pickPreferred(
  candidates: DictData[],
  currentPlatform: string,
): DictData | undefined {
  return (
    candidates.find((d) => d.platform === currentPlatform) ??
    candidates.find((d) => d.tagType) ??
    candidates[0]
  );
}

/**
 * 字典查表 hook。所有 fallback 文案 / 色值集中在本 hook 内；
 * 应用层只消费 helper，不再持有 SWITCH_STATUS_FALLBACK 这类常量。
 */
export function useDictLookups(
  options: UseDictLookupsOptions = {},
): DictLookups {
  const {
    typeCodes = DEFAULT_TYPE_CODES,
    includeGeneral = true,
    platformLabels,
  } = options;

  // 拉原始字典数据（薄包装 useListDictData，无 fallback）
  const query = useListDictData({
    typeCode: typeCodes,
    includeGeneral,
  });
  // 用 useMemo 包住 items，避免 useMemo deps 依赖的数组引用每次 render 都变。
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // 1) 按 typeCode + value 拆桶，2) 每桶用 pickPreferred 选最优一条
  const { switchHits, platformHits } = useMemo(() => {
    const switchByValue = new Map<string, DictData[]>();
    const platformByValue = new Map<string, DictData[]>();
    for (const d of items) {
      const bucket =
        d.typeCode === 'sys_switch_status'
          ? switchByValue
          : d.typeCode === 'sys_platform'
            ? platformByValue
            : null;
      if (!bucket) continue;
      const arr = bucket.get(d.value) ?? [];
      arr.push(d);
      bucket.set(d.value, arr);
    }
    const pick = (m: Map<string, DictData[]>) => {
      const out = new Map<string, DictData>();
      for (const [v, candidates] of m.entries()) {
        const hit = pickPreferred(candidates, CURRENT_PLATFORM);
        if (hit) out.set(v, hit);
      }
      return out;
    };
    return {
      switchHits: pick(switchByValue),
      platformHits: pick(platformByValue),
    };
  }, [items]);

  // 3) helper：每个 fallback 在 hook 内闭环
  const lookupSwitchLabel = (n: 0 | 1 | number): string => {
    const hit = switchHits.get(isEnabledKey(n));
    return hit?.label ?? SWITCH_LABEL_FALLBACK[n === 1 ? 1 : 0];
  };
  const lookupSwitchTagType = (n: 0 | 1 | number): string | undefined => {
    const hit = switchHits.get(isEnabledKey(n));
    return hit?.tagType ?? SWITCH_TAG_TYPE_FALLBACK[n === 1 ? 1 : 0];
  };
  const lookupPlatformLabel = (p: string | undefined): string => {
    if (!p) return '-';
    const hit = platformHits.get(p);
    return hit?.label ?? p;
  };
  const lookupPlatformTagType = (p: string | undefined): string | undefined => {
    if (!p) return undefined;
    return platformHits.get(p)?.tagType;
  };

  // 4) valueEnum：直接喂 ProTable.valueEnum
  const switchValueEnum: Record<0 | 1, { text: string }> = {
    1: { text: lookupSwitchLabel(1) },
    0: { text: lookupSwitchLabel(0) },
  };

  const platformValueEnum: Record<string, { text: string }> = (() => {
    const out: Record<string, { text: string }> = {};
    if (items.length === 0) {
      // dict 还没拉回来 → 用 platformLabels 兜底
      for (const [v, label] of Object.entries(platformLabels ?? {})) {
        out[v] = { text: label };
      }
      return out;
    }
    // dict 已加载：优先 dict.label，缺值用 platformLabels，再缺用 raw value
    for (const [v, hit] of platformHits.entries()) {
      out[v] = { text: hit.label };
    }
    for (const [v, label] of Object.entries(platformLabels ?? {})) {
      if (!out[v]) out[v] = { text: label };
    }
    return out;
  })();

  return {
    lookupSwitchLabel,
    lookupSwitchTagType,
    lookupPlatformLabel,
    lookupPlatformTagType,
    switchValueEnum,
    platformValueEnum,
    loaded: items.length > 0,
  };
}