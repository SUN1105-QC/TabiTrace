import { describe, expect, it, vi } from 'vitest'
import { PAYMENT_STATUS, paymentSucceeded, pollPayment } from '@/utils/payment'
import type { PaymentView } from '@/services/tabitrace-api'

const row = (status: string): PaymentView => ({ id: 7, tripId: 5, product: 'TRIP_PRO', status, provider: 'STRIPE', amount: 400, currency: 'CNY', createdAt: '' })
describe('specific-order payment confirmation', () => {
  it('paid and partial refunds retain access, full refunds and disputes do not', () => {
    expect(paymentSucceeded(row('PAID'))).toBe(true)
    expect(paymentSucceeded(row('PARTIALLY_REFUNDED'))).toBe(true)
    expect(paymentSucceeded(row('REFUNDED'))).toBe(false)
    expect(paymentSucceeded(row('DISPUTED'))).toBe(false)
    expect(PAYMENT_STATUS.EXPIRED).toBe('订单已关闭')
  })
  it('queries the channel once and polls the owned order until confirmed', async () => {
    const refresh=vi.fn().mockResolvedValue(row('PENDING')), get=vi.fn().mockResolvedValue(row('PAID')), wait=vi.fn()
    expect((await pollPayment(7,{refresh,get,wait}))?.status).toBe('PAID')
    expect(refresh).toHaveBeenCalledOnce(); expect(get).toHaveBeenCalledWith(7)
  })
  it('timeout is pending, not failure or an endless busy state', async () => {
    const get=vi.fn().mockResolvedValue(row('PENDING')), wait=vi.fn()
    expect(await pollPayment(7,{refresh:get,get,wait,attempts:3})).toBeNull()
    expect(wait).toHaveBeenCalledTimes(2)
  })
  it('does not accept another order as proof of payment', async () => {
    const get=vi.fn().mockResolvedValue({...row('PAID'),id:8})
    expect(await pollPayment(7,{refresh:get,get,wait:vi.fn(),attempts:1})).toBeNull()
  })
  it('returns terminal failures without exhausting polling', async () => {
    const get=vi.fn().mockResolvedValue(row('REFUNDED')), wait=vi.fn()
    expect((await pollPayment(7,{refresh:get,get,wait}))?.status).toBe('REFUNDED')
    expect(wait).not.toHaveBeenCalled()
  })
  it('aborts stale polling after unmount or a trip switch', async () => {
    const get=vi.fn()
    await expect(pollPayment(7,{refresh:get,get,wait:vi.fn(),cancelled:()=>true})).rejects.toThrow('查询已结束')
    expect(get).not.toHaveBeenCalled()
  })
})
