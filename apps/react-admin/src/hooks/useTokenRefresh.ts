/**
 * Token 定时刷新管理
 * 主动定时刷新 access_token，refresh 依赖 cookie。
 * 不再触发 SSE 重连（SSE 已超出本任务范围）。
 */
import { useAuthStore } from '@/stores/auth';

const ACCESS_TOKEN_REFRESH_INTERVAL = 90 * 60 * 1000;
const SAFETY_BUFFER_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 3 * 1000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function computeNextInterval(): number {
  const { accessTokenExpireAt } = useAuthStore.getState();
  const now = Date.now();
  const accessRemaining = (accessTokenExpireAt ?? 0) - now;
  if (!accessTokenExpireAt || accessRemaining <= 0) return MIN_INTERVAL_MS;
  if (accessRemaining <= SAFETY_BUFFER_MS) return MIN_INTERVAL_MS;
  return Math.floor(
    Math.max(
      MIN_INTERVAL_MS,
      Math.min(ACCESS_TOKEN_REFRESH_INTERVAL, (accessRemaining - SAFETY_BUFFER_MS) * 0.8),
    ),
  );
}

function scheduleRefresh(): void {
  stopRefreshTimer();
  const tick = async () => {
    try {
      await useAuthStore.getState().refreshToken();
    } catch (error) {
      console.error('[TokenRefresh] 定时刷新失败:', error);
    } finally {
      if (refreshTimer !== null) {
        refreshTimer = globalThis.setTimeout(tick, computeNextInterval());
      }
    }
  };
  refreshTimer = globalThis.setTimeout(tick, computeNextInterval());
}

export function startRefreshTimer(): void {
  scheduleRefresh();
}

export function stopRefreshTimer(): void {
  if (refreshTimer !== null) {
    globalThis.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
