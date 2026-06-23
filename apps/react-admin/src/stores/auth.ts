import { create } from 'zustand';
import i18next from 'i18next';

import { loginApi, getUserInfoApi, refreshTokenApi, logoutApi } from '@/api/rest/auth';
import { startRefreshTimer, stopRefreshTimer } from '@/hooks/useTokenRefresh';
import type { UserInfo, LoginRequest } from '@/api/rest/types';

const STORAGE_KEY = 'auth-storage';
const REMEMBER_KEY = 'auth-remember';
const USER_INFO_KEY = 'auth-user-info';

export interface LoginOptions {
  remember?: boolean;
}

export interface AuthState {
  // Token 状态
  accessToken: string | null;
  accessTokenExpireAt: number | null;

  // 用户状态
  userInfo: UserInfo | null;

  // UI 状态
  loginLoading: boolean;
  error: string | null;

  // 动作
  login: (
    params: LoginRequest,
    options?: LoginOptions,
    onSuccess?: () => void,
  ) => Promise<void>;
  logout: (redirect?: boolean) => Promise<void>;
  refreshToken: () => Promise<string>;
  reauthenticate: () => void;
  forceLogout: () => void;
  setUserInfo: (info: UserInfo) => void;
  clearError: () => void;
  $reset: () => void;

  // 内部：手动持久化
  hydrate: () => void;
}

const DEFAULT_ACCESS_EXPIRES_IN = 7200; // 2 小时

function pickStorage(remember: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  return remember ? window.localStorage : window.sessionStorage;
}

function getRememberFromCookie(): boolean {
  if (typeof window === 'undefined') return true;
  // 默认 true；用户取消勾选后存到 sessionStorage 的 REMEMBER_KEY='0'
  return window.localStorage.getItem(REMEMBER_KEY) !== '0';
}

function persistState(
  state: Pick<AuthState, 'accessToken' | 'accessTokenExpireAt'>,
  remember: boolean,
) {
  if (typeof window === 'undefined') return;
  const target = pickStorage(remember);
  // 切到另一种 storage 时清掉对端残留
  const other = remember ? window.sessionStorage : window.localStorage;
  other.removeItem(STORAGE_KEY);
  if (target) {
    target.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

function clearPersisted() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
  window.localStorage.removeItem(USER_INFO_KEY);
  window.sessionStorage.removeItem(USER_INFO_KEY);
}

function persistUserInfo(info: UserInfo) {
  if (typeof window === 'undefined') return;
  try {
    const remember = getRememberFromCookie();
    const target = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;
    other.removeItem(USER_INFO_KEY);
    target.setItem(USER_INFO_KEY, JSON.stringify(info));
  } catch (err) {
    console.warn('[auth.persistUserInfo] failed', err);
  }
}

function readPersistedUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const remember = getRememberFromCookie();
  const raw = (remember ? window.localStorage : window.sessionStorage).getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

function readPersisted(): {
  accessToken: string | null;
  accessTokenExpireAt: number | null;
} {
  if (typeof window === 'undefined') {
    return { accessToken: null, accessTokenExpireAt: null };
  }
  // 优先读 remember=true 选择的 storage
  const remember = getRememberFromCookie();
  const raw = pickStorage(remember)?.getItem(STORAGE_KEY);
  if (!raw) return { accessToken: null, accessTokenExpireAt: null };
  try {
    const parsed = JSON.parse(raw) as {
      accessToken?: string;
      accessTokenExpireAt?: number;
    };
    return {
      accessToken: parsed.accessToken ?? null,
      accessTokenExpireAt: parsed.accessTokenExpireAt ?? null,
    };
  } catch {
    return { accessToken: null, accessTokenExpireAt: null };
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: null,
  accessTokenExpireAt: null,
  userInfo: null,
  loginLoading: false,
  error: null,

  hydrate: () => {
    const persisted = readPersisted();
    const userInfo = readPersistedUserInfo();
    set({ ...persisted, userInfo });
  },

  login: async (params, options = {}, onSuccess) => {
    const remember = options.remember ?? true;
    set({ loginLoading: true, error: null });

    try {
      // 1. 登录（明文密码）
      const response = await loginApi(params);
      const now = Date.now();
      const accessToken = response.accessToken;
      const expiresAt = now + DEFAULT_ACCESS_EXPIRES_IN * 1000;

      set({ accessToken, accessTokenExpireAt: expiresAt });
      persistState({ accessToken, accessTokenExpireAt: expiresAt }, remember);

      // 2. 拉取完整用户信息（vben 形态）
      let userInfo: UserInfo | null = null;
      try {
        userInfo = await getUserInfoApi();
      } catch (userErr) {
        console.warn('[auth.login] getUserInfo failed, fallback to login response', userErr);
        userInfo = {
          id: response.id,
          username: response.username,
          realName: response.realName,
          roles: response.roles,
          homePath: response.homePath,
        };
      }
      set({ userInfo });
      persistUserInfo(userInfo);

      // 3. 启动定时刷新
      startRefreshTimer();

      // 4. 跳转交给 onSuccess 回调（页面层用 react-router 的 navigate，避免整页刷新丢内存）
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : i18next.t('auth:loginFailed', { defaultValue: '登录失败' });
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loginLoading: false });
    }
  },

  logout: async (_redirect = true) => {
    stopRefreshTimer();
    try {
      await logoutApi().catch(() => {});
    } finally {
      clearPersisted();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user-storage');
      }
      set({
        accessToken: null,
        accessTokenExpireAt: null,
        userInfo: null,
        error: null,
        loginLoading: false,
      });
    }
  },

  refreshToken: async () => {
    try {
      const response = await refreshTokenApi();
      const now = Date.now();
      const accessToken = response.accessToken;
      const accessTokenExpireAt = now + DEFAULT_ACCESS_EXPIRES_IN * 1000;
      set({ accessToken, accessTokenExpireAt });
      const remember = getRememberFromCookie();
      persistState({ accessToken, accessTokenExpireAt }, remember);
      return accessToken;
    } catch (err) {
      console.error('[auth.refreshToken] failed', err);
      get().forceLogout();
      return '';
    }
  },

  reauthenticate: () => {
    set({ error: i18next.t('auth:sessionExpired', { defaultValue: '会话已过期' }) });
  },

  forceLogout: () => {
    stopRefreshTimer();
    clearPersisted();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('user-storage');
    }
    set({
      accessToken: null,
      accessTokenExpireAt: null,
      userInfo: null,
      error: null,
      loginLoading: false,
    });
  },

  setUserInfo: (info) => {
    set({ userInfo: info });
    if (info) persistUserInfo(info);
    else if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_INFO_KEY);
    }
  },
  clearError: () => set({ error: null }),

  $reset: () =>
    set({
      accessToken: null,
      accessTokenExpireAt: null,
      userInfo: null,
      error: null,
      loginLoading: false,
    }),
}));
