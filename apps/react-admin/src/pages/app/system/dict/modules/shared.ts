import type { DictType, DictData } from '@/api/rest/types';

export const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** 字典类型平台归属选项。空字符串=通用；其他值为各前端管理端。 */
export const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '通用' },
  { value: 'vue-admin', label: 'vue-admin' },
  { value: 'react-admin', label: 'react-admin' },
];

/** 当前应用默认平台，用于列表默认筛选；从 Vite 环境变量读取。 */
export const DEFAULT_PLATFORM: string =
  (import.meta.env.VITE_APP_PLATFORM as string | undefined) ?? '';

export type { DictType, DictData };