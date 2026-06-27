/** vben 风格的 mock 接口类型 */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  id: number | string;
  username: string;
  realName: string;
  roles: string[];
  homePath?: string;
  accessToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export type AccessCode = string;

export interface UserInfo {
  id: number | string;
  username: string;
  realName: string;
  roles: string[];
  homePath?: string;
  avatar?: string;
  email?: string;
  tenantId?: string | number;
  [k: string]: unknown;
}

export interface UserListItem {
  id: string;
  username: string;
  realName: string;
  email: string;
  phone: string;
  status: 0 | 1;
  roles: string[];
  remark: string;
  createTime: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  username?: string;
  realName?: string;
  status?: 0 | 1;
  [k: string]: unknown;
}

export interface CreateUserRequest {
  username: string;
  realName?: string;
  email?: string;
  phone?: string;
  status?: 0 | 1;
  roles?: string[];
  remark?: string;
}

export interface UpdateUserRequest {
  id: string;
  data: Partial<UserListItem>;
}

export interface MenuMeta {
  title?: string;
  icon?: string;
  order?: number;
  hideInMenu?: boolean;
  affixTab?: boolean;
  keepAlive?: boolean;
  authority?: string[];
  iframeSrc?: string;
  link?: string;
  badge?: string;
  badgeType?: string;
  badgeVariants?: string;
  [k: string]: unknown;
}

export interface MenuItem {
  id?: number | string;
  name?: string;
  path?: string;
  component?: string;
  redirect?: string;
  meta?: MenuMeta;
  children?: MenuItem[];
  [k: string]: unknown;
}

// ============================================================
// 字典管理（dict_type / dict_data）
// 字段对齐 backend-mock-template 的 schema；软删 deleted_at: 0=未删
// ============================================================

export interface DictType {
  id: number;
  code: string;
  /** 平台标识：`''` = 通用、`vue-admin` / `react-admin` 为各前端管理端 */
  platform: string;
  name: string;
  remark: string;
  is_enabled: 0 | 1;
  deleted_at: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface DictData {
  id: number;
  type_id: number;
  value: string;
  label: string;
  sort: number;
  is_default: 0 | 1;
  is_enabled: 0 | 1;
  deleted_at: number;
  remark: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  /** 关联的字典类型编码（仅 list 接口返回） */
  typeCode?: string;
}

export interface DictTypeQuery {
  page?: number;
  pageSize?: number;
  /** 字典类型编码；前端多选下拉时传数组（精确匹配任一） */
  code?: string | string[];
  name?: string;
  status?: 0 | 1;
  /** 平台标识筛选；undefined = 不过滤；'' = 仅通用；非空 = 该平台 + 通用 */
  platform?: string;
}

export interface DictDataQuery {
  page?: number;
  pageSize?: number;
  typeId?: number;
  typeCode?: string;
  label?: string;
  value?: string;
  status?: 0 | 1;
  /** 平台标识筛选（按所属 type 的 platform 过滤）；undefined = 不过滤；'' = 仅通用；非空 = 该平台 + 通用 */
  platform?: string;
}

export interface CreateDictTypeRequest {
  code: string;
  platform?: string;
  name: string;
  remark?: string;
  is_enabled?: 0 | 1;
}

export interface UpdateDictTypeRequest {
  id: number;
  code?: string;
  platform?: string;
  name?: string;
  remark?: string;
  is_enabled?: 0 | 1;
}

export interface CreateDictDataRequest {
  typeId: number;
  value: string;
  label: string;
  sort?: number;
  isDefault?: boolean;
  is_enabled?: 0 | 1;
  remark?: string;
}

export interface UpdateDictDataRequest {
  id: number;
  value?: string;
  label?: string;
  sort?: number;
  is_default?: 0 | 1;
  is_enabled?: 0 | 1;
  remark?: string;
}
