import { useTranslation, type UseTranslationOptions, type TFunction as I18nTFunction } from 'react-i18next';
import { type SupportedLocale } from '@/locales';

// 类型安全 t 函数
export type TFunction = I18nTFunction;

// 封装 useTranslation，自动推导命名空间
// 支持核心命名空间和扩展命名空间
export const useI18n = <N extends string = 'common'>(
  ns?: N | readonly N[],
  options?: UseTranslationOptions,
) => {
  // 统一转成数组，默认使用 'common' 命名空间
  const namespace = ns ? (Array.isArray(ns) ? ns : [ns]) : ['common'];

  const { t, i18n, ...rest } = useTranslation<string, N>(namespace as readonly N[], options);

  // 切换语言
  const changeLocale = async (locale: SupportedLocale) => {
    await i18n.changeLanguage(locale);
  };

  return {
    t,
    i18n,
    changeLocale,
    ...rest,
  };
};