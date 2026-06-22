import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Spin, Alert } from 'antd';
import { useLocation } from 'react-router-dom';

import { usePreferences } from '@/core/preferences';
import { useI18n } from '@/core/i18n';

import './iframe-layout.less';

/**
 * Iframe 布局：嵌入外部系统（如报表、文档等）
 * 支持：自动高度、加载状态、跨域通信
 */
const IFrameLayout = () => {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = usePreferences();
  const { t } = useI18n('common');

  // 从路由 state 或 query 获取 iframe URL
  const iframeSrc = useMemo(() => {
    // 优先使用路由 state 中的 url
    if (location.state?.url) {
      return location.state.url as string;
    }
    // 其次从 query 参数获取
    const searchParams = new URLSearchParams(location.search);
    const url = searchParams.get('url');
    if (url) {
      return url;
    }
    // 兜底：当前路径可能是 iframe 标识，需要从菜单配置映射
    return '';
  }, [location.state, location.search]);

  // iframe 加载完成
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  // iframe 加载失败
  const handleError = useCallback(() => {
    setLoading(false);
    setError(t('iframe.loadErrorDesc'));
  }, [t]);

  // 跨域通信：监听 iframe 发来的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 可根据 origin 校验来源安全性
      // const allowedOrigins = ['https://example.com'];
      // if (!allowedOrigins.includes(event.origin)) return;

      const { type, data } = event.data || {};

      switch (type) {
        case 'resize':
          // iframe 内部通知高度变化，实现自适应
          if (iframeRef.current && data?.height) {
            iframeRef.current.style.height = `${data.height}px`;
          }
          break;
        case 'route-change':
          // iframe 内部路由变化，可同步到主应用面包屑等
          console.log('[IFrame] route change:', data);
          break;
        case 'ready':
          // iframe 内部应用初始化完成
          setLoading(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 向 iframe 发送消息（跨域通信）
  const postMessageToIframe = useCallback((type: string, data?: any) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type, data }, '*');
  }, []);

  // 主题切换时通知 iframe
  useEffect(() => {
    if (!loading) {
      postMessageToIframe('theme-change', { mode: isDark ? 'dark' : 'light' });
    }
  }, [isDark, loading, postMessageToIframe]);

  // 无 URL 时显示提示
  if (!iframeSrc) {
    return (
      <div className="iframe-layout-empty">
        <Alert
          type="warning"
          title={t('iframe.noUrlTitle')}
          description={t('iframe.noUrlDesc')}
          showIcon
        />
      </div>
    );
  }

  return (
    <div className={`iframe-layout-wrapper ${isDark ? 'dark' : 'light'}`}>
      {loading && (
        <div className="iframe-layout-loading">
          <Spin size="large" description={t('iframe.loading')} />
        </div>
      )}

      {error && (
        <div className="iframe-layout-error">
          <Alert type="error" title={t('iframe.loadErrorTitle')} description={error} showIcon />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="iframe-layout-content"
        onLoad={handleLoad}
        onError={handleError}
        title={t('iframe.embeddedPage')}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        allow="clipboard-read; clipboard-write"
        style={{ visibility: loading ? 'hidden' : 'visible' }}
      />
    </div>
  );
};

export default IFrameLayout;
