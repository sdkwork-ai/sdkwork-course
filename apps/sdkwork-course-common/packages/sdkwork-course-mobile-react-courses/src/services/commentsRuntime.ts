import type { SdkworkAppClient } from '@sdkwork/comments-app-sdk'

let commentsClient: SdkworkAppClient | null = null

export interface CommentsRuntimeConfig {
  client: SdkworkAppClient
}

export function configureCommentsRuntime(config: CommentsRuntimeConfig): void {
  commentsClient = config.client
}

export function getCommentsRuntimeClient(): SdkworkAppClient {
  if (!commentsClient) {
    throw new Error('Comments runtime has not been configured')
  }
  return commentsClient
}
