import { get, post } from './request';
import type { AccessCode, LoginRequest, LoginResponse, RefreshTokenResponse, UserInfo } from './types';

/** 登录 */
export function loginApi(body: LoginRequest) {
  return post<LoginResponse>('/auth/login', body);
}

/** 登出 */
export function logoutApi() {
  return post<unknown>('/auth/logout');
}

/** 刷新 token（依赖 cookie，不带 body） */
export function refreshTokenApi() {
  return post<RefreshTokenResponse>('/auth/refresh');
}

/** 获取权限码 */
export function getAccessCodesApi() {
  return get<AccessCode[]>('/auth/codes');
}

/** 获取当前用户信息 */
export function getUserInfoApi() {
  return get<UserInfo>('/user/info');
}
