/**
 * REST 风格的请求封装（vben mock 风格）
 *
 * 统一走 RequestClient，path 形如 `/auth/login`、`/system/user/list`。
 * 响应统一是 `useResponseSuccess({...})` 包装，返回的 `T` 即是 `data` 字段。
 */
import { RequestClient } from '@/core/transport/rest';

export interface ListPageQuery {
  page?: number;
  pageSize?: number;
  [k: string]: unknown;
}

function client() {
  return RequestClient.getInstance();
}

export function get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
  return client().get<T>(path, { params }) as Promise<T>;
}

export function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  return client().post<T>(path, body as never) as Promise<T>;
}

export function put<T = unknown>(path: string, body?: unknown): Promise<T> {
  return client().put<T>(path, body as never) as Promise<T>;
}

export function del<T = unknown>(path: string, body?: unknown): Promise<T> {
  return client().delete<T>(path, body ? { data: body } : undefined) as Promise<T>;
}
