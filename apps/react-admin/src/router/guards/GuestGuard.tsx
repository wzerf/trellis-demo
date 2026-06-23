import { Navigate, useSearchParams } from 'react-router-dom';
import React from 'react';
import { useAuthStore } from '@/stores';

interface GuestGuardProps {
  isAuthenticated?: boolean;
  children: React.ReactNode;
  redirectPath?: string;
}

/**
 * 访客守卫：已登录用户不能访问（如登录页、注册页）
 * 如果已登录，重定向到 redirect 参数指定页面或首页
 */
export const GuestGuard = ({
  isAuthenticated: isAuthenticatedProp,
  children,
  redirectPath = '/',
}: GuestGuardProps) => {
  const [searchParams] = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const homePath = useAuthStore((s) => s.userInfo?.homePath);
  const isAuthenticated = isAuthenticatedProp ?? !!accessToken;

  if (isAuthenticated) {
    const redirect = searchParams.get('redirect') || homePath || redirectPath;
    return <Navigate to={decodeURIComponent(redirect)} replace />;
  }

  return <>{children}</>;
};
