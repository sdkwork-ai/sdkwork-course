import { appApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';



export class QuestionBankTaxonomyApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** question Bank Taxonomy retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<Record<string, unknown>> {
    return this.client.request<Record<string, unknown>>(appApiPath(`/question_bank/taxonomy`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export function createQuestionBankTaxonomyApi(client: HttpClient): QuestionBankTaxonomyApi {
  return new QuestionBankTaxonomyApi(client);
}
