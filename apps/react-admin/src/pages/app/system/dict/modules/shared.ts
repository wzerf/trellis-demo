import type { DictType, DictData } from '@/api/rest/types';

export const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * 当前前端平台标识（VITE_APP_PLATFORM）。
 * 缺省 'general'，与 schema v8 DEFAULT 对齐。
 */
export function getCurrentPlatform(): string {
  return (import.meta.env.VITE_APP_PLATFORM as string | undefined) || 'general';
}

/**
 * 字典项 platform 字段的候选下拉选项。
 * 当前前端只应选择「自己」+「通用」两类；其它平台的项不允许本前端维护。
 * 选项 label 留空 → 由 antd Select 渲染 value 即可；调用方可自定义渲染。
 */
export const PLATFORM_OPTIONS: { value: string; label: string }[] = (() => {
  const current = getCurrentPlatform();
  const list: { value: string; label: string }[] = [
    { value: 'general', label: '通用' },
  ];
  if (current !== 'general') {
    list.push({ value: current, label: current });
  }
  return list;
})();

/**
 * 字典项 platform 字段的搜索下拉候选（搜索场景不限制「自己」，展示全部 3 项）。
 * 与 PLATFORM_OPTIONS（表单 Select）区分：搜索需要看全 platform；表单只允许维护自己。
 * label 硬编码：columns 在 module-level 定义，无法直接用 useTranslation；如需 i18n
 * 可改为 component-level columns 并使用 t()。
 */
export const SEARCH_PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: '通用' },
  { value: 'react-admin', label: 'React Admin' },
  { value: 'vue-admin', label: 'Vue Admin' },
];

export type { DictType, DictData };