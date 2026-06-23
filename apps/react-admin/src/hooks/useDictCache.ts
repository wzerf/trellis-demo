/**
 * 字典缓存 Hook（精简版 stub）
 *
 * 字典后端接口已在精简过程中裁掉（`apps/backend-mock-template` 不提供 dict list）。
 * 该文件保留以保持调用方不报错；如需恢复，参见 git 历史。
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
let cacheLoaded = false;

export async function fetchAllDictEntries(): Promise<void> {
  // no-op: 字典接口未实现
  cacheLoaded = true;
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
  cacheLoaded = false;
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
