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

/** 列出全部字典类型（下拉用） */
export function listAllDictTypeApi(params?: { status?: 0 | 1 }) {
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