import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN/course.json';
import enUS from './locales/en-US/course.json';
import { tryGetCoursePcSdkPorts } from '../sdkPorts';

const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function normalizeLanguage(value: unknown): SupportedLanguage {
  if (typeof value !== 'string') {
    return 'zh-CN';
  }
  const normalized = value.trim();
  if (normalized === 'en' || normalized === 'en-US') {
    return 'en-US';
  }
  return 'zh-CN';
}

function resolveInitialLanguage(): SupportedLanguage {
  try {
    const hostLanguage = tryGetCoursePcSdkPorts()?.resolveHostLanguage?.();
    if (hostLanguage) {
      return normalizeLanguage(hostLanguage);
    }
  } catch {
    // Host SDK ports may not be configured during standalone bootstrap.
  }
  return 'zh-CN';
}

const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: { 'zh-CN': { course: zhCN }, 'en-US': { course: enUS } },
  lng: resolveInitialLanguage(),
  fallbackLng: 'zh-CN',
  ns: ['course'],
  defaultNS: 'course',
  interpolation: { escapeValue: false },
});

export function syncCourseHostLanguage(): void {
  try {
    const hostLanguage = tryGetCoursePcSdkPorts()?.resolveHostLanguage?.();
    if (!hostLanguage) {
      return;
    }
    const nextLanguage = normalizeLanguage(hostLanguage);
    if (i18n.language !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  } catch {
    // Host SDK ports may not be configured during standalone bootstrap.
  }
}

export function subscribeCourseHostLanguage(): (() => void) | undefined {
  try {
    const subscribe = tryGetCoursePcSdkPorts()?.subscribeHostLanguage;
    if (!subscribe) {
      return undefined;
    }
    return subscribe((language) => {
      const nextLanguage = normalizeLanguage(language);
      if (i18n.language !== nextLanguage) {
        void i18n.changeLanguage(nextLanguage);
      }
    });
  } catch {
    return undefined;
  }
}

export default i18n;
