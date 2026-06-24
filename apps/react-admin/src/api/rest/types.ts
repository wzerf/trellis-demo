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
}

export interface DictTypeQuery {
  page?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  status?: 0 | 1;
}

export interface DictDataQuery {
  page?: number;
  pageSize?: number;
  typeId?: number;
  label?: string;
  value?: string;
  status?: 0 | 1;
}

export interface CreateDictTypeRequest {
  code: string;
  name: string;
  remark?: string;
  is_enabled?: 0 | 1;
}

export interface UpdateDictTypeRequest {
  id: number;
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
