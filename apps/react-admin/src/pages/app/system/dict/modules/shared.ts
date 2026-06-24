import type { DictType, DictData } from '@/api/rest/types';

export const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export type { DictType, DictData };