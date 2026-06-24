import { del, get, post, put } from './request';
import type {
  CreateDictDataRequest,
  DictData,
  DictDataQuery,
  PageResult,
  UpdateDictDataRequest,
} from './types';

/** 分页列出字典项 */
export function listDictDataApi(query: DictDataQuery = {}) {
  return get<PageResult<DictData>>(
    '/system/dict-data/list',
    query as Record<string, unknown>,
  );
}

/** 按类型 code 取启用字典项（下拉用） */
export function listDictDataByTypeCodeApi(typeCode: string) {
  return get<DictData[]>(`/system/dict-data/by-type/${encodeURIComponent(typeCode)}`);
}

/** 新建字典项 */
export function createDictDataApi(body: CreateDictDataRequest) {
  return post<DictData>('/system/dict-data', body);
}

/** 更新字典项 */
export function updateDictDataApi({ id, ...patch }: UpdateDictDataRequest) {
  return put<DictData>(`/system/dict-data/${id}`, patch);
}

/** 删除字典项 */
export function deleteDictDataApi(id: number) {
  return del<unknown>(`/system/dict-data/${id}`);
}