import { resolveBaseUrlWithAlignProtocol } from '@sdkwork/sdk-common'

export interface RuntimeConfig {
  apiBaseUrl: string
  appApiPrefix: string
  environment: 'development' | 'test' | 'staging' | 'production'
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    // Single-call §6.3 resolution: the explicit Vite override wins as a
    // candidate, and the returned origin always follows the page scheme.
    apiBaseUrl: resolveBaseUrlWithAlignProtocol({
      baseUrls: import.meta.env.VITE_API_BASE_URL || undefined,
    }).url,
    appApiPrefix: '/app/v3/api',
    environment: (import.meta.env.MODE as RuntimeConfig['environment']) || 'development',
  }
}

