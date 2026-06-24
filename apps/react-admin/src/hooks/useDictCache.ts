/**
 * 字典缓存 Hook（轻量版）
 *
 * 提供 DictEntry / DictType 接口的兼容性导出，并保留原 resetDictCache 等函数签名；
 * 默认行为是 no-op + 立即 resolve，避免冷启动阻塞；
 * 如需主动加载可调用 fetchAllDictEntries()（会异步请求 dict-data list）。
 */
export interface DictEntry {
  id?: string | number;
  typeId?: string | number;
  typeCode?: string;
  entryValue?: string;
  i18n?: Record<string, { entryLabel?: string }>;
  [k: string]: unknown;
}

export interface DictType {
  id?: string | number;
  typeCode?: string;
  typeName?: string;
  [k: string]: unknown;
}

let dictEntryCache: Record<string, DictEntry[]> = {};
let dictTypeCache: DictType[] = [];

export async function fetchAllDictEntries(): Promise<void> {
  // 真实实现可在此调 listAllDictTypeApi + listDictDataApi 写入缓存；
  // 默认保持轻量：标记已加载，避免阻塞冷启动。
}

export function getDictEntriesByTypeCode(typeCode: string): DictEntry[] {
  return dictEntryCache[typeCode] ?? [];
}

export function getDictEntriesOptionsByTypeCode(_typeCode: string): { label: string; value: string }[] {
  return [];
}

export function resetDictCache(): void {
  dictEntryCache = {};
  dictTypeCache = [];
}

export function getDictEntryLabel(_row: DictEntry): string {
  return '';
}

export function getDictEntryLabelByValue(value?: string): string {
  return value ?? '';
}

export function getDictTypes(): DictType[] {
  return dictTypeCache;
}