import { get } from './request';
import type { MenuItem } from './types';

/** 拉取所有菜单 */
export function getAllMenusApi() {
  return get<MenuItem[]>('/menu/all');
}
