import React, { useEffect, useState } from 'react'
import { Button, Modal, Notice, formatPrice } from '@sdkwork/sdkwork-course-pc-commons'
import {
  CoursePurchaseUnavailableError,
  createCourseCheckout,
  retrieveCoursePaymentStatus,
  useCourseSdk,
  type CourseCheckoutPayment,
} from '@sdkwork/sdkwork-course-pc-core'

export interface CoursePurchasePanelProps {
  courseId: string
  onClose: () => void
  onPurchased?: () => void
  open: boolean
  priceAmount?: string
}

export function CoursePurchasePanel({
  courseId,
  onClose,
  onPurchased,
  open,
  priceAmount,
}: CoursePurchasePanelProps) {
  const sdk = useCourseSdk()
  const [checkout, setCheckout] = useState<CourseCheckoutPayment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    setCheckout(null)
    setPaid(false)
    void createCourseCheckout(courseId, sdk)
      .then((result) => {
        if (!cancelled) setCheckout(result)
      })
      .catch((reason) => {
        if (cancelled) return
        setError(
          reason instanceof CoursePurchaseUnavailableError
            ? reason.message
            : reason instanceof Error
              ? reason.message
              : '订单创建失败，请稍后重试',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseId, open, sdk])

  useEffect(() => {
    if (!open || !checkout || paid) return undefined
    let cancelled = false
    const timer = window.setInterval(() => {
      void retrieveCoursePaymentStatus(checkout.orderId, sdk)
        .then((status) => {
          if (cancelled || !status.paid) return
          setPaid(true)
          onPurchased?.()
        })
        .catch(() => undefined)
    }, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [checkout, onPurchased, open, paid, sdk])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="购买课程"
      description="订单与支付由 SDKWork 订单中心统一处理"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            稍后支付
          </Button>
          {checkout?.cashierUrl ? (
            <Button onClick={() => window.open(checkout.cashierUrl, '_blank', 'noopener,noreferrer')}>
              打开支付页面
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {loading ? <p className="text-sm text-slate-500">正在向订单中心创建订单...</p> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {paid ? <Notice tone="success">支付成功，课程权益正在同步。</Notice> : null}

        {checkout ? (
          <>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">应付金额</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatPrice(checkout.amount, false, checkout.currencyCode)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                订单号 {checkout.orderNo ?? checkout.orderId} · 状态 {checkout.status}
              </p>
            </div>

            {checkout.qrCode ? (
              <div className="rounded-xl border border-slate-100 p-4 text-center">
                <p className="break-all text-xs text-slate-500">支付参数：{checkout.qrCode}</p>
              </div>
            ) : null}

            {!checkout.qrCode && !checkout.cashierUrl ? (
              <Notice tone="info">订单已创建，请在订单中心继续完成支付。</Notice>
            ) : null}
          </>
        ) : null}

        {priceAmount && !checkout ? (
          <p className="text-sm text-slate-500">课程售价 {formatPrice(priceAmount, false, 'CNY')}</p>
        ) : null}
      </div>
    </Modal>
  )
}
