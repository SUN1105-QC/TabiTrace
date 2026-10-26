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
import { planApi, tripApi, userApi, type TripSummary, type TripView } from '@/services/tabitrace-api'
import { membershipApi } from '@/services/user-music'
import type { TripProPlan } from '@/utils/plan'

export type PayState = 'idle' | 'loading' | 'confirming' | 'success' | 'cancelled' | 'failed' | 'already'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

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
    setTrip(t)
    setTrips(ts => ts.map(x => (x.id === t.id ? t : x)))
  }, [])

  const refreshMembership = useCallback(() => {
    membershipApi.current().then(m => setMember(m.status === 'ACTIVE')).catch(() => setMember(false))
  }, [])

  // 付款返回后确认结果：以旅行的真实方案为准，最多等 30 秒
  const confirmPaid = useCallback(async (tripId: number) => {
    setPay('confirming')
    for (let i = 0; i < 15; i++) {
      try {
        const t = await tripApi.get(tripId)
        if (t.planType === 'PRO') { replaceTrip(t); setPay('success'); return }
      } catch { /* 继续等待 */ }
      await wait(2000)
    }
    setPayMessage('支付结果还在确认中，稍后刷新本页即可看到最新状态；如已扣款，旅行会自动解锁。')
  }, [replaceTrip])

  // 买断付款返回后确认：以 lifetimePro 为准，确认后刷新旅行列表（所有旅行都会变成 PRO）
  const confirmLifetime = useCallback(async () => {
    setLifePay('confirming')
    for (let i = 0; i < 15; i++) {
      try {
        const me = await userApi.refresh()
        if (me.lifetimePro) {
          setLifetime(true); setLifePay('success'); refreshMembership()
          const rows = await tripApi.list(); setTrips(rows); setTrip(t => rows.find(x => x.id === t?.id) ?? t)
          return
        }
      } catch { /* 继续等待 */ }
      await wait(2000)
    }
    setLifeMessage('支付结果还在确认中，稍后刷新本页即可看到最新状态；如已扣款，终身 Pro 会自动生效。')
  }, [refreshMembership])

  useEffect(() => {
    loadPlan()
    const q = new URLSearchParams(window.location.search)
    const wanted = Number(q.get('trip') || 0)
    const payment = q.get('payment')
    const forLifetime = q.get('plan') === 'lifetime'
    const session = hasSession()
    setLoggedIn(session)
    if (!session) { setLoadingTrip(false); return }
    userApi.me().then(me => setLifetime(Boolean(me.lifetimePro))).catch(() => {})
    refreshMembership()
    if (forLifetime && payment === 'cancelled') setLifePay('cancelled')
    if (forLifetime && payment === 'success') void confirmLifetime()
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
          if (!forLifetime && payment === 'success') void confirmPaid(picked.id)
        }
      } catch {
        setTrip(null)
      } finally {
        setLoadingTrip(false)
        if (payment) { q.delete('payment'); q.delete('plan'); window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}${window.location.hash}`) }
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
    plan, planError, loadPlan, loggedIn,
    trips, trip, summary, loadingTrip, selectTrip,
    pay, payMessage, mockPaid, checkout,
    lifetime, member, lifePay, lifeMessage, lifeMock, checkoutLifetime
  }
}

export type TripProState = ReturnType<typeof useTripPro>
