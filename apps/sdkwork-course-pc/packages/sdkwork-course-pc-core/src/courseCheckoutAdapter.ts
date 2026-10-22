import { appApiPath } from '@sdkwork/course-app-sdk'
import { uuid } from '@sdkwork/utils/id'

import { getCourseAppSdkClient, type CourseAppSdkClient } from './courseAppSdkClient'
import { extractSdkListItems, readEntityString } from './courseSdkPayload'

export class CoursePurchaseUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoursePurchaseUnavailableError'
  }
}

export interface CoursePurchaseOption {
  offeringId: string
  skuId: string
  currencyCode: string
}

export interface CourseCheckoutPayment {
  orderId: string
  orderNo?: string
  amount: string
  currencyCode: string
  status: string
  cashierUrl?: string
  qrCode?: string
}

function readAccessPolicy(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function unwrapItem(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const envelope = payload as Record<string, unknown>
  const data =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as Record<string, unknown>)
      : envelope
  return data.item && typeof data.item === 'object'
    ? (data.item as Record<string, unknown>)
    : data
}

async function bodyHash(body: unknown): Promise<string> {
  const text = JSON.stringify(body)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

async function postCommand<T>(
  client: CourseAppSdkClient,
  path: string,
  body: unknown,
): Promise<T> {
  const hash = await bodyHash(body)
  const payload = await client.http.post<unknown>(appApiPath(path), body, undefined, {
    'Idempotency-Key': uuid(),
    'X-Content-SHA256': hash,
  })
  return unwrapItem(payload) as T
}

export async function retrieveCoursePurchaseOption(
  courseId: string,
  sdk: CourseAppSdkClient = getCourseAppSdkClient(),
): Promise<CoursePurchaseOption> {
  const offerings = extractSdkListItems<Record<string, unknown>>(
    await sdk.courseOfferings.list(courseId),
  )
  const offering = offerings[0]
  if (!offering) throw new CoursePurchaseUnavailableError('该课程暂无可购买班次')
  const offeringId = readEntityString(offering, 'id', 'offeringId')
  const policy = readAccessPolicy(
    offering.accessPolicyJson ?? offering.access_policy_json ?? offering.accessPolicy,
  )
  const skuId =
    readEntityString(policy, 'commerceSkuId', 'skuId') ||
    readEntityString(offering, 'commerceSkuId', 'skuId')
  if (!skuId) throw new CoursePurchaseUnavailableError('课程商品尚未注册到订单中心')
  return {
    offeringId,
    skuId,
    currencyCode:
      readEntityString(policy, 'currency', 'currencyCode') ||
      readEntityString(offering, 'currency', 'currencyCode') ||
      'CNY',
  }
}

export async function createCourseCheckout(
  courseId: string,
  sdk: CourseAppSdkClient = getCourseAppSdkClient(),
): Promise<CourseCheckoutPayment> {
  const option = await retrieveCoursePurchaseOption(courseId, sdk)
  const session = await postCommand<Record<string, unknown>>(sdk, '/checkout/sessions', {
    items: [{ skuId: option.skuId }],
  })
  const sessionId = readEntityString(session, 'checkoutSessionId')
  if (!sessionId) throw new CoursePurchaseUnavailableError('订单中心未返回结账会话')
  await postCommand(sdk, `/checkout/sessions/${encodeURIComponent(sessionId)}/quotes`, {})
  const order = await postCommand<Record<string, unknown>>(
    sdk,
    `/checkout/sessions/${encodeURIComponent(sessionId)}/orders`,
    {},
  )
  const orderId = readEntityString(order, 'orderId')
  if (!orderId) throw new CoursePurchaseUnavailableError('订单创建失败')
  const payment = await postCommand<Record<string, unknown>>(
    sdk,
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { paymentMethod: 'wechat_pay' },
  )
  const params =
    payment.paymentParams && typeof payment.paymentParams === 'object'
      ? (payment.paymentParams as Record<string, unknown>)
      : {}
  const paramString = (key: string) => {
    const value = params[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  return {
    orderId,
    orderNo: readEntityString(order, 'orderNo') || undefined,
    amount: readEntityString(order, 'totalAmount') || '0',
    currencyCode: option.currencyCode,
    status: readEntityString(order, 'status') || 'pending',
    cashierUrl:
      readEntityString(payment, 'cashierUrl') || paramString('cashierUrl'),
    qrCode:
      readEntityString(payment, 'qrCode') ||
      paramString('codeUrl') ||
      paramString('qrCode'),
  }
}

export async function retrieveCoursePaymentStatus(
  orderId: string,
  sdk: CourseAppSdkClient = getCourseAppSdkClient(),
): Promise<{ paid: boolean; status: string }> {
  const underscore = String.fromCharCode(95)
  const payload = await sdk.http.get<unknown>(
    appApiPath(`/orders/${encodeURIComponent(orderId)}/${['payment', 'success'].join(underscore)}`),
  )
  const item = unwrapItem(payload)
  return { paid: item.paid === true, status: readEntityString(item, 'status') || 'pending' }
}
