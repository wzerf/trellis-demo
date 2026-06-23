import { del, get, post, put } from './request';
import type {
  CreateUserRequest,
  PageResult,
  UpdateUserRequest,
  UserListItem,
  UserListQuery,
} from './types';

/** 分页列出用户 */
export function listUsersApi(query: UserListQuery) {
  return get<PageResult<UserListItem>>('/system/user/list', query as Record<string, unknown>);
}

/** 创建用户 */
export function createUserApi(body: CreateUserRequest) {
  return post<UserListItem>('/system/user', body);
}

/** 更新用户 */
export function updateUserApi({ id, data }: UpdateUserRequest) {
  return put<UserListItem>(`/system/user/${id}`, data);
}

/** 删除用户 */
export function deleteUserApi(id: string) {
  return del<unknown>(`/system/user/${id}`);
}
