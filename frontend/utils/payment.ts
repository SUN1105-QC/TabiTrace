import type { PaymentView } from '@/services/tabitrace-api'

export const PAYMENT_STATUS: Record<string, string> = {
  PENDING: '待付款或确认中', PAID: '已付款', FAILED: '付款失败', EXPIRED: '订单已关闭',
  PARTIALLY_REFUNDED: '部分退款', REFUNDED: '已全额退款', DISPUTED: '付款争议处理中'
}
export const paymentSucceeded = (p: PaymentView) => ['PAID', 'PARTIALLY_REFUNDED'].includes(p.status)

/** Poll a specific owned order; a URL parameter or unrelated Pro entitlement is never proof of payment. */
export async function pollPayment(id: number, io: {
  get: (id: number) => Promise<PaymentView>
  refresh: (id: number) => Promise<PaymentView>
  wait: (ms: number) => Promise<void>
  attempts?: number
  cancelled?: () => boolean
}) {
  for (let i = 0; i < (io.attempts ?? 15); i++) {
    if (io.cancelled?.()) throw new Error('查询已结束')
    try {
      const p = await (i === 0 ? io.refresh(id).catch(() => io.get(id)) : io.get(id))
      if (p.id !== id) throw new Error('付款记录与订单不一致')
      if (p.status !== 'PENDING') return p
    } catch { /* transient errors are retried; expiry of the polling window is not a failed payment */ }
    if (i + 1 < (io.attempts ?? 15)) await io.wait(2000)
  }
  return null
}
