/**
 * 顶层 API 入口。
 *
 * 新代码请直接 import：
 *   import { AuthApi, UserApi, MenuApi } from '@/api/rest';
 *   import { useLogin, fetchUserInfo, ... } from '@/api/hooks/auth';
 *   import { useListUsers, useCreateUser, ... } from '@/api/hooks/user';
 *
 * 旧 `apiClient.*` 命名空间已废弃，调用会抛错。
 */
export * from './rest';
export * from './hooks';
export { apiClient } from './client';
