import type { EventHandlerRequest, H3Event } from "h3";

import { deleteCookie, getCookie, setCookie } from "h3";

// 在开发环境（HTTP）下使用 lax + 不强制 secure，让浏览器能正常发送 cookie。
// 生产环境（VITE 前端 https 部署）下保持 none + secure。
const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  secure: isProd,
  path: "/",
};

export function clearRefreshTokenCookie(event: H3Event<EventHandlerRequest>) {
  deleteCookie(event, "jwt", cookieOptions);
}

export function setRefreshTokenCookie(event: H3Event<EventHandlerRequest>, refreshToken: string) {
  setCookie(event, "jwt", refreshToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60, // unit: seconds
  });
}

export function getRefreshTokenFromCookie(event: H3Event<EventHandlerRequest>) {
  const refreshToken = getCookie(event, "jwt");
  return refreshToken;
}
