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

/**
 * 搜索下拉用：不含「通用」选项。
 * 编辑表单仍然使用 PLATFORM_OPTIONS（创建/编辑通用类型仍需此选项）。
 */
export const PLATFORM_SEARCH_OPTIONS: { value: string; label: string }[] =
  PLATFORM_OPTIONS.filter((o) => o.value !== '');

/**
 * 右表平台标识搜索下拉：包含「通用」选项。
 * 用途：点行选中 platform=''（通用）时，下拉需要能把 value='' 渲染成"通用"
 * 标签，否则选中后字段显示为空白。
 * 后端语义：选「通用」时 value=''，前端透传 platform=''，后端把它识别为「仅通用」。
 */
export const PLATFORM_ENTRY_SEARCH_OPTIONS: { value: string; label: string }[] =
  PLATFORM_OPTIONS;

/** 当前应用默认平台，用于列表默认筛选；从 Vite 环境变量读取。 */
export const DEFAULT_PLATFORM: string =
  (import.meta.env.VITE_APP_PLATFORM as string | undefined) ?? '';

export type { DictType, DictData };