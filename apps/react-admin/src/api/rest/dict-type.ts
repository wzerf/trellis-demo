import { del, get, post, put } from './request';
import type {
  CreateDictTypeRequest,
  DictType,
  DictTypeQuery,
  PageResult,
  UpdateDictTypeRequest,
} from './types';

/** 分页列出字典类型 */
export function listDictTypeApi(query: DictTypeQuery = {}) {
  return get<PageResult<DictType>>(
    '/system/dict-type/list',
    query as Record<string, unknown>,
  );
}

/**
 * 列出全部字典类型（用于联动：把当前搜索条件下「全部命中行」的 typeCode
 * 推送给右表做多选过滤，因此接口需要支持与 list 同样的过滤项）。
 */
export function listAllDictTypeApi(params?: {
  status?: 0 | 1;
  code?: string | string[];
  name?: string;
  platform?: string;
}) {
  return get<DictType[]>('/system/dict-type/all', (params ?? {}) as Record<string, unknown>);
}

/** 字典类型详情 */
export function getDictTypeApi(id: number) {
  return get<DictType>(`/system/dict-type/${id}`);
}

/** 新建字典类型 */
export function createDictTypeApi(body: CreateDictTypeRequest) {
  return post<DictType>('/system/dict-type', body);
}

/** 更新字典类型 */
export function updateDictTypeApi({ id, ...patch }: UpdateDictTypeRequest) {
  return put<DictType>(`/system/dict-type/${id}`, patch);
}

/** 删除字典类型 */
export function deleteDictTypeApi(id: number) {
  return del<unknown>(`/system/dict-type/${id}`);
}

/** 批量操作字典类型 */
export function batchDictTypeApi(body: {
  action: 'enable' | 'disable' | 'delete';
  ids: number[];
}) {
  return post<{ action: string; affected: number; ids: number[] }>(
    '/system/dict-type/batch',
    body,
  );
}