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
