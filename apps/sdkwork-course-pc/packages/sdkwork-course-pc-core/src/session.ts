import { alignBaseUrlToPageProtocol, createTokenManager, type AuthTokenManager } from '@sdkwork/sdk-common';
import { isBlank, trim } from '@sdkwork/utils/string';

export interface CourseSessionUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface CourseSession {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  user?: CourseSessionUser;
}

export const COURSE_SESSION_STORAGE_KEY = 'sdkwork-course:session:v1';
export const COURSE_SESSION_CHANGED_EVENT = 'sdkwork-course:session-changed';

let globalTokenManager: AuthTokenManager | null = null;

function readBootstrapAccessToken(): string | undefined {
  const fromProcess = trim(
    typeof process !== 'undefined'
      ? String((process.env as Record<string, string | undefined>).SDKWORK_ACCESS_TOKEN ?? '')
      : '',
  );
  return isBlank(fromProcess) ? undefined : fromProcess;
}

export function loadCourseSession(): CourseSession | null {
  if (typeof window === 'undefined') {
    const accessToken = readBootstrapAccessToken();
    return accessToken ? { accessToken } : null;
  }

  const legacyRaw = window.sessionStorage.getItem(COURSE_SESSION_STORAGE_KEY);
  const raw = window.localStorage.getItem(COURSE_SESSION_STORAGE_KEY) ?? legacyRaw;
  if (legacyRaw && !window.localStorage.getItem(COURSE_SESSION_STORAGE_KEY)) {
    window.localStorage.setItem(COURSE_SESSION_STORAGE_KEY, legacyRaw);
    window.sessionStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
  }
  if (raw) {
    try {
      return JSON.parse(raw) as CourseSession;
    } catch {
      window.localStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
    }
  }

  const accessToken = readBootstrapAccessToken();
  return accessToken ? { accessToken } : null;
}

export function saveCourseSession(session: CourseSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!session) {
    window.localStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(COURSE_SESSION_STORAGE_KEY, JSON.stringify(session));
    window.sessionStorage.removeItem(COURSE_SESSION_STORAGE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(COURSE_SESSION_CHANGED_EVENT, { detail: { session } }),
  );
}

export function resolveAppApiBaseUrl(): string {
  const configured = trim(import.meta.env.VITE_API_BASE_URL ?? '');
  if (!isBlank(configured)) {
    // §6.3 protocol adaptation: the explicit override's scheme follows the
    // page scheme on the shared dual-scheme edge.
    return alignBaseUrlToPageProtocol(configured.replace(/\/+$/, ''));
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:8080';
}

export function getCourseGlobalTokenManager(): AuthTokenManager {
  if (!globalTokenManager) {
    globalTokenManager = createTokenManager();
  }
  const session = loadCourseSession();
  if (session?.accessToken || session?.authToken) {
    globalTokenManager.setTokens({
      ...(session.accessToken ? { accessToken: session.accessToken } : {}),
      ...(session.authToken ? { authToken: session.authToken } : {}),
    });
  }
  return globalTokenManager;
}

export function resetCourseGlobalTokenManager(): void {
  globalTokenManager = null;
}

export function readCourseSessionTokens(): CourseSession | null {
  return loadCourseSession();
}

export function resolveCourseAccessToken(session: CourseSession | null = loadCourseSession()): string | undefined {
  const token = trim(session?.accessToken ?? '');
  return isBlank(token) ? undefined : token;
}

export function resolveCourseAuthToken(session: CourseSession | null = loadCourseSession()): string | undefined {
  const token = trim(session?.authToken ?? '');
  return isBlank(token) ? undefined : token;
}
