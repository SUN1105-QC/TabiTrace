'use client'

/**
 * Trip Pro 页面的数据与购买流程（页面和各区块只读这里的状态，不各自请求）：
 * - 方案配置 GET /plans/trip-pro：价格、Free 限制、Travel Story / 分享图规格，全部以后端为准
 * - 当前旅行：?trip= 指定 → 正在进行的旅行（localStorage）→ 第一段未归档的旅行
 * - 单次升级：模拟支付环境立即完成；Stripe 环境跳转付款页，返回后轮询旅行方案确认，确认不了就如实提示
 * - 买断 · 终身 Pro：同样的流程，以用户资料里的 lifetimePro 为准；账号会员（上传自己的音乐）读 /membership
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, hasSession } from '@/services/api'
import { paymentApi, planApi, tripApi, userApi, type TripSummary, type TripView } from '@/services/tabitrace-api'
import { membershipApi } from '@/services/user-music'
import type { TripProPlan } from '@/utils/plan'
import { PAYMENT_STATUS, paymentSucceeded, pollPayment } from '@/utils/payment'

export type PayState = 'idle' | 'loading' | 'confirming' | 'pending' | 'success' | 'cancelled' | 'failed' | 'already'

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function useTripPro() {
  const [plan, setPlan] = useState<TripProPlan | null>(null)
  const [planError, setPlanError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [trips, setTrips] = useState<TripView[]>([])
  const [trip, setTrip] = useState<TripView | null>(null)
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [loadingTrip, setLoadingTrip] = useState(true)
  const [pay, setPay] = useState<PayState>('idle')
  const [payMessage, setPayMessage] = useState('')
  const [mockPaid, setMockPaid] = useState(false)
  const paying = useRef(false)
  // 买断 · 终身 Pro 与账号会员
  const [lifetime, setLifetime] = useState(false)
  const [member, setMember] = useState(false)
  const [lifePay, setLifePay] = useState<PayState>('idle')
  const [lifeMessage, setLifeMessage] = useState('')
  const [lifeMock, setLifeMock] = useState(false)
  const lifePaying = useRef(false)

  const loadPlan = useCallback(() => {
    setPlanError('')
    planApi.tripPro().then(setPlan).catch(e => setPlanError(e instanceof Error && e.message ? e.message : '请稍后再试'))
  }, [])

  /** 旅行统计：天数、地点数（状态卡）与打卡 / 照片用量（免费旅行） */
  const loadSummary = useCallback((t: TripView) => {
    setSummary(null)
    tripApi.summary(t.id).then(s => setSummary(s.tripId === t.id ? s : null)).catch(() => setSummary(null))
  }, [])

  const replaceTrip = useCallback((t: TripView) => {
    setTrip(current => current?.id === t.id ? t : current)
    setTrips(ts => ts.map(x => (x.id === t.id ? t : x)))
  }, [])

  const refreshMembership = useCallback(() => {
    membershipApi.current().then(m => setMember(m.status === 'ACTIVE')).catch(() => setMember(false))
  }, [])

  const mounted = useRef(true)
  const tripRun = useRef(0)
  const lifeRun = useRef(0)
  const tripOrder = useRef<number | undefined>(undefined)
  const lifetimeOrder = useRef<number | undefined>(undefined)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; tripRun.current++; lifeRun.current++ }
  }, [])

  const reloadEntitlements = useCallback(async () => {
    const [me, rows, membership] = await Promise.all([userApi.refresh(), tripApi.list(), membershipApi.current()])
    setLifetime(Boolean(me.lifetimePro)); setMember(membership.status === 'ACTIVE')
    setTrips(rows); setTrip(current => rows.find(t => t.id === current?.id) ?? current)
  }, [])

  // Confirm the specific order, never an unrelated Pro flag or the success URL alone.
  const confirmPaid = useCallback(async (tripId: number, orderId?: number) => {
    const run = ++tripRun.current
    const active = () => mounted.current && run === tripRun.current
    setPay('confirming'); setPayMessage('')
    try {
      const id = orderId ?? (await tripApi.latestPayment(tripId))?.id
      if (!id) throw new Error('未找到这次付款的订单，请在付款记录中查询')
      tripOrder.current = id
      const p = await pollPayment(id, { ...paymentApi, wait, cancelled: () => !active() })
      if (!active()) return
      if (!p) { setPay('pending'); setPayMessage('暂未确认付款结果，请重新查询或在付款记录中继续原订单，请勿重复付款。'); return }
      if (p.tripId !== tripId || p.product !== 'TRIP_PRO') throw new Error('付款订单与当前旅行不一致')
      if (paymentSucceeded(p)) { await reloadEntitlements(); if (active()) setPay('success') }
      else { setPay('failed'); setPayMessage(PAYMENT_STATUS[p.status] ?? '请在付款记录中核实结果') }
    } catch (e) {
      if (active()) { setPay('pending'); setPayMessage(e instanceof Error ? e.message : '请在付款记录中查询结果') }
    }
  }, [reloadEntitlements])

  const confirmLifetime = useCallback(async (orderId?: number) => {
    const run = ++lifeRun.current
    const active = () => mounted.current && run === lifeRun.current
    setLifePay('confirming'); setLifeMessage('')
    try {
      const id = orderId ?? (await tripApi.latestLifetimePayment())?.id
      if (!id) throw new Error('未找到这次付款的订单，请在付款记录中查询')
      lifetimeOrder.current = id
      const p = await pollPayment(id, { ...paymentApi, wait, cancelled: () => !active() })
      if (!active()) return
      if (!p) { setLifePay('pending'); setLifeMessage('暂未确认付款结果，请重新查询或在付款记录中继续原订单，请勿重复付款。'); return }
      if (p.product !== 'LIFETIME') throw new Error('付款订单与终身方案不一致')
      if (paymentSucceeded(p)) { await reloadEntitlements(); if (active()) setLifePay('success') }
      else { setLifePay('failed'); setLifeMessage(PAYMENT_STATUS[p.status] ?? '请在付款记录中核实结果') }
    } catch (e) {
      if (active()) { setLifePay('pending'); setLifeMessage(e instanceof Error ? e.message : '请在付款记录中查询结果') }
    }
  }, [reloadEntitlements])

  useEffect(() => {
    loadPlan()
    const q = new URLSearchParams(window.location.search)
    const wanted = Number(q.get('trip') || 0)
    const payment = q.get('payment')
    const parsedOrder = Number(q.get('order'))
    const orderId = Number.isSafeInteger(parsedOrder) && parsedOrder > 0 ? parsedOrder : undefined
    const forLifetime = q.get('plan') === 'lifetime'
    const session = hasSession()
    setLoggedIn(session)
    if (!session) { setLoadingTrip(false); return }
    userApi.me().then(me => setLifetime(Boolean(me.lifetimePro))).catch(() => {})
    refreshMembership()
    if (forLifetime && payment === 'cancelled') setLifePay('cancelled')
    if (forLifetime && payment === 'success') void confirmLifetime(orderId)
    void (async () => {
      try {
        const rows = await tripApi.list()
        setTrips(rows)
        const stored = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
        const picked = rows.find(t => t.id === wanted) || rows.find(t => t.id === stored) || rows.find(t => t.status !== 'ARCHIVED') || rows[0] || null
        setTrip(picked)
        if (picked) {
          loadSummary(picked)
          if (!forLifetime && payment === 'cancelled') setPay('cancelled')
          if (!forLifetime && payment === 'success') void confirmPaid(picked.id, orderId)
        }
      } catch {
        setTrip(null)
      } finally {
        setLoadingTrip(false)
        if (payment) { q.delete('payment'); q.delete('plan'); q.delete('order'); window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}${window.location.hash}`) }
      }
    })()
  }, [loadPlan, loadSummary, confirmPaid, confirmLifetime, refreshMembership])

  // 从别处带锚点进来（例如 /pricing#pr-lifetime）：内容是读完方案和旅行后才渲染的，布局稳定后滚动一次
  const scrolledToHash = useRef(false)
  useEffect(() => {
    if (!plan || loadingTrip || scrolledToHash.current || !window.location.hash) return
    scrolledToHash.current = true
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
  }, [plan, loadingTrip])

  const selectTrip = (id: number) => {
    const t = trips.find(x => x.id === id)
    if (!t) return
    tripRun.current++; tripOrder.current = undefined
    setTrip(t); setPay('idle'); setPayMessage(''); loadSummary(t)
    const q = new URLSearchParams(window.location.search); q.set('trip', String(id))
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
  }

  const checkout = async () => {
    if (paying.current || !trip || trip.planType === 'PRO') return
    paying.current = true
    setPay('loading'); setPayMessage('')
    let redirecting = false
    try {
      const r = await tripApi.checkout(trip.id)
      if (r?.mock) {
        const t = await tripApi.get(trip.id)
        replaceTrip(t); setMockPaid(true)
        setPay(t.planType === 'PRO' ? 'success' : 'failed')
        if (t.planType !== 'PRO') setPayMessage('支付记录已创建，但旅行还没有解锁，请稍后刷新')
      } else if (r?.checkoutUrl) {
        redirecting = true
        window.location.assign(r.checkoutUrl)
      } else {
        setPay('failed'); setPayMessage('没有拿到支付页面，请稍后再试')
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TRIP_ALREADY_PRO') {
        const t = await tripApi.get(trip.id).catch(() => null)
        if (t) replaceTrip(t)
        setPay('already')
      } else {
        setPay('failed'); setPayMessage(e instanceof Error && e.message ? e.message : '请稍后再试')
      }
    } finally {
      if (!redirecting) paying.current = false
    }
  }

  const checkoutLifetime = async () => {
    if (lifePaying.current || lifetime) return
    lifePaying.current = true
    setLifePay('loading'); setLifeMessage('')
    let redirecting = false
    try {
      const r = await tripApi.checkoutLifetime()
      if (r?.mock) {
        const me = await userApi.refresh()
        setLifetime(Boolean(me.lifetimePro)); setLifeMock(true)
        setLifePay(me.lifetimePro ? 'success' : 'failed')
        if (!me.lifetimePro) setLifeMessage('支付记录已创建，但终身 Pro 还没有生效，请稍后刷新')
        refreshMembership()
        const rows = await tripApi.list(); setTrips(rows); setTrip(t => rows.find(x => x.id === t?.id) ?? t)
      } else if (r?.checkoutUrl) {
        redirecting = true
        window.location.assign(r.checkoutUrl)
      } else {
        setLifePay('failed'); setLifeMessage('没有拿到支付页面，请稍后再试')
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'LIFETIME_ALREADY_OWNED') { setLifetime(true); setLifePay('already') }
      else { setLifePay('failed'); setLifeMessage(e instanceof Error && e.message ? e.message : '请稍后再试') }
    } finally {
      if (!redirecting) lifePaying.current = false
    }
  }

  return {
    reloadEntitlements,
    recheckTrip: () => trip && confirmPaid(trip.id, tripOrder.current),
    recheckLifetime: () => confirmLifetime(lifetimeOrder.current),
    plan, planError, loadPlan, loggedIn,
    trips, trip, summary, loadingTrip, selectTrip,
    pay, payMessage, mockPaid, checkout,
    lifetime, member, lifePay, lifeMessage, lifeMock, checkoutLifetime
  }
}

export type TripProState = ReturnType<typeof useTripPro>
