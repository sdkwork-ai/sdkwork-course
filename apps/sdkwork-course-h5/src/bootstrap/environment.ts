import { resolveBaseUrl } from '@sdkwork/sdk-common'

export interface RuntimeConfig {
  apiBaseUrl: string
  appApiPrefix: string
  environment: 'development' | 'test' | 'staging' | 'production'
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || resolveBaseUrl().url,
    appApiPrefix: '/app/v3/api',
    environment: (import.meta.env.MODE as RuntimeConfig['environment']) || 'development',
  }
}

