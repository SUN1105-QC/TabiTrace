'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { paymentApi, type PaymentView } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'
import { PAYMENT_STATUS } from '@/utils/payment'

export function PaymentHistory({ refreshKey, onUpdated }: { refreshKey: string; onUpdated: () => Promise<void> }) {
  const [rows, setRows] = useState<PaymentView[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const working = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await paymentApi.history()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : '读取付款记录失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load, refreshKey])

  async function act(p: PaymentView, action: 'refresh' | 'resume' | 'cancel') {
    if (working.current) return
    working.current = true; setBusy(p.id); setError('')
    try {
      if (action === 'resume') {
        const r = await paymentApi.resume(p.id)
        if (!r.mock && r.checkoutUrl) { window.location.assign(r.checkoutUrl); return }
      } else if (action === 'cancel') await paymentApi.cancel(p.id)
      else await paymentApi.refresh(p.id)
      await onUpdated(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败，请稍后重试') }
    finally { working.current = false; setBusy(null) }
  }

  return <section className="pr-section" aria-labelledby="pr-payments-title">
    <header className="pr-section-head"><h2 id="pr-payments-title">付款记录</h2><p>金额均为人民币。关闭待付款订单会关闭原付款页；已付款订单不会因此退款。</p></header>
    {error && <p role="alert" className="pr-notice is-bad">{error}</p>}
    <button type="button" className="pr-btn" disabled={loading || busy !== null} onClick={() => void load()}>{loading ? '正在读取…' : '刷新记录'}</button>
    {!loading && !rows.length && !error && <p>暂无付款记录。</p>}
    <ul className="pr-payment-list">{rows.map(p => <li key={p.id}>
      <div><b>{p.product === 'LIFETIME' ? '终身 Pro' : `旅行 #${p.tripId ?? '已删除'} · Trip Pro`}</b>
        <p>订单 #{p.id} · {formatCurrency(p.amount, p.currency)} · {PAYMENT_STATUS[p.status] ?? '状态待核实'}{p.provider === 'MOCK' ? ' · 模拟支付' : ''}</p>
        {Boolean(p.refundedAmount) && <p>已退款 {formatCurrency(p.refundedAmount, p.currency)}</p>}
        <small>{p.createdAt.replace('T', ' ')} UTC</small>
      </div>
      <div className="pr-trip-actions">
        {p.provider === 'STRIPE' && <button type="button" className="pr-btn" disabled={busy !== null} onClick={() => void act(p, 'refresh')}>{busy === p.id ? '处理中…' : '查询结果'}</button>}
        {p.status === 'PENDING' && <>
          <button type="button" className="pr-btn is-primary" disabled={busy !== null} onClick={() => void act(p, 'resume')}>继续原订单</button>
          {p.providerPaymentId && <button type="button" className="pr-btn" disabled={busy !== null} onClick={() => void act(p, 'cancel')}>关闭待付款订单</button>}
        </>}
      </div>
    </li>)}</ul>
  </section>
}
