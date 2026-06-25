import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from './useI18n';
import { usePreferencesStore } from '@/core/preferences';
import type { SupportedLocale } from '@/locales';

export const useLocaleSync = () => {
  const { i18n } = useI18n();
  // 使用稳定的选择器，避免每次渲染创建新对象
  const locale = usePreferencesStore((state) => state.preferences.app.locale);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);

  // 标记是否已初始化
  const initialized = useRef(false);

  // 稳定引用 i18n，避免 i18n 实例引用变化导致 effect 重复跑
  const i18nRef = useRef(i18n);
  useEffect(() => {
    i18nRef.current = i18n;
  }, [i18n]);

  // preferences 变更 → 切换 i18n 语言
  useEffect(() => {
    const i18nInstance = i18nRef.current;
    if (locale && i18nInstance.language !== locale) {
      i18nInstance.changeLanguage(locale).catch((error) => {
        console.error('Failed to switch language:', error);
      });
    }
  }, [locale]);

  // i18n 初始化后，只在第一次反向同步到 store
  useEffect(() => {
    if (i18n.isInitialized && !locale && !initialized.current) {
      initialized.current = true;
      const detected = i18n.language as SupportedLocale;
      setPreferences({ app: { locale: detected } });
    }
  }, [i18n.isInitialized, i18n.language, locale, setPreferences]);

  // 便捷切换方法
  const changeLocale = useCallback(
    (newLocale: SupportedLocale) => {
      setPreferences({ app: { locale: newLocale } });
    },
    [setPreferences],
  );

  return { changeLocale };
};
