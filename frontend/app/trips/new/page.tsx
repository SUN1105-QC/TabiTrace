'use client'

/**
 * 创建旅行 · Journey Setup：去哪里 → 什么时候 → 和几个人 → 自动准备 → 创建。
 * 单页完成；左侧（手机端为顶部紧凑版）实时预览。官方探索只在目的地真的有官方内容时出现。
 * 创建成功后短暂显示真实完成的内容，然后进入新旅行的详情页。
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Loader2, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { DestinationSearch } from '@/components/trip/create/DestinationSearch'
import { JourneyPreview } from '@/components/trip/create/JourneyPreview'
import { CreateSummary, JourneySuccess, OfficialGuideCard, SetupItems, TravelerStepper } from '@/components/trip/create/JourneySections'
import { tripApi, userApi, type TripView } from '@/services/tabitrace-api'
import {
  TRAVELERS_MAX, TRAVELERS_MIN, addDays, calculateTripDuration, localToday, suggestedTitle, validateJourney,
  type JourneyErrors, type PickedDestination
} from '@/utils/journey'

const FIELD_ORDER: (keyof JourneyErrors)[] = ['title', 'destination', 'startDate', 'endDate', 'travelers']
const FIELD_ID: Record<keyof JourneyErrors, string> = { title: 'cj-title', destination: 'cj-destination', startDate: 'cj-start', endDate: 'cj-end', travelers: 'cj-travelers' }

export default function NewTripPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [destination, setDestination] = useState<PickedDestination | null>(null)
  const [joinOfficial, setJoinOfficial] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [travelers, setTravelers] = useState(TRAVELERS_MIN)
  const [errors, setErrors] = useState<JourneyErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [limit, setLimit] = useState<{ active: number; max: number } | null>(null)
  const [created, setCreated] = useState<{ trip: TripView; officialAdded: number | null } | null>(null)
  const submitting = useRef(false)
  const goTimer = useRef<number | undefined>(undefined)

  // 默认从今天出发、三天行程（可改），日期在客户端生成，避免服务端与浏览器日期不一致
  useEffect(() => { const s = localToday(); setStartDate(s); setEndDate(addDays(s, 2)) }, [])
  // 免费版同时只能保留 1 段进行中的 FREE 旅行（后端同样会拦截），提前告诉用户
  useEffect(() => {
    userApi.overview().then(o => { if (o.activeFreeTrips >= o.freeTripLimit) setLimit({ active: o.activeFreeTrips, max: o.freeTripLimit }) }).catch(() => {})
    return () => window.clearTimeout(goTimer.current)
  }, [])

  const clearError = (k: keyof JourneyErrors) => setErrors(e => (e[k] ? { ...e, [k]: undefined } : e))

  const chooseDestination = (d: PickedDestination | null) => {
    setDestination(d)
    clearError('destination')
    if (d?.official) setJoinOfficial(true)
    if (!titleTouched) setTitle(suggestedTitle(d))
    if (d && !titleTouched) clearError('title')
  }

  const changeStart = (v: string) => {
    setStartDate(v); clearError('startDate')
    if (v && endDate && endDate < v) { setEndDate(v); clearError('endDate') }
  }

  const duration = calculateTripDuration(startDate, endDate)
  const official = destination?.official ?? null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting.current || limit) return
    const found = validateJourney({ title, destination, startDate, endDate, travelers })
    setErrors(found)
    const first = FIELD_ORDER.find(k => found[k])
    if (first) { document.getElementById(FIELD_ID[first])?.focus(); return }
    submitting.current = true
    setBusy(true); setSubmitError('')
    try {
      const d = destination!
      const trip = await tripApi.create({
        title: title.trim(), destinationName: d.name, city: d.name, countryCode: d.countryCode,
        startDate, endDate, peopleCount: travelers, coverImage: d.coverImage ?? undefined,
        joinOfficialExplore: Boolean(d.official && joinOfficial)
      })
      localStorage.setItem('tabitrace-live-trip-id', String(trip.id))
      // 成功页只展示真实结果：官方地点数量以创建后查询到的为准
      let officialAdded: number | null = null
      if (d.official && joinOfficial) {
        try { officialAdded = (await tripApi.places(trip.id)).filter(p => p.sourceType === 'OFFICIAL').length } catch { officialAdded = null }
      }
      setCreated({ trip, officialAdded })
      goTimer.current = window.setTimeout(() => router.push(`/trips/${trip.id}`), 2800)
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : '创建旅行失败，请稍后再试')
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="cj-page mx-auto max-w-[1180px] px-5 pb-14 sm:px-8">
        <header className="cj-heading">
          <p className="cj-eyebrow">CREATE A JOURNEY</p>
          <h1>开启一段新的旅行</h1>
          <p>去哪里、什么时候、和几个人。其余的，旅迹会替你准备好。</p>
        </header>

        {limit && (
          <div className="cj-limit" role="status">
            <TriangleAlert size={17} aria-hidden="true" />
            <p>
              免费版同时只能保留 {limit.max} 段进行中的旅行，你已经有 {limit.active} 段。
              <span>把已有旅行升级为 Trip Pro，或在旅行详情里将它归档后，就可以创建新的旅行。</span>
            </p>
            <Link href="/trips">管理我的旅行</Link>
          </div>
        )}

        <div className="cj-layout">
          <aside className="cj-aside">
            <JourneyPreview title={title} destination={destination} startDate={startDate} endDate={endDate} travelers={travelers} joinOfficial={joinOfficial} />
          </aside>

          <form className="cj-form" onSubmit={submit} noValidate aria-label="创建旅行">
            <div className="cj-mobile-preview">
              <JourneyPreview compact title={title} destination={destination} startDate={startDate} endDate={endDate} travelers={travelers} joinOfficial={joinOfficial} />
            </div>

            <Step n="01" title="这次要去哪里？">
              <Field label="旅行名称" htmlFor="cj-title" error={errors.title}>
                <input
                  id="cj-title" className="cj-input" maxLength={200} autoComplete="off"
                  placeholder={destination ? suggestedTitle(destination) : '例如：秋天的京都散步'}
                  value={title}
                  onChange={e => { setTitle(e.target.value); setTitleTouched(true); clearError('title') }}
                  aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'cj-title-error' : undefined}
                />
              </Field>
              <Field label="目的地" htmlFor="cj-destination">
                <DestinationSearch id="cj-destination" value={destination} onChange={chooseDestination} error={errors.destination} />
              </Field>
              {official && <OfficialGuideCard guide={official} join={joinOfficial} onJoin={setJoinOfficial} />}
            </Step>

            <Step n="02" title="什么时候出发？">
              <div className="cj-dates">
                <Field label="出发日期" htmlFor="cj-start" error={errors.startDate}>
                  <input id="cj-start" type="date" className="cj-input" value={startDate} onChange={e => changeStart(e.target.value)}
                    aria-invalid={Boolean(errors.startDate)} aria-describedby={errors.startDate ? 'cj-start-error' : undefined} />
                </Field>
                <Field label="返回日期" htmlFor="cj-end" error={errors.endDate}>
                  <input id="cj-end" type="date" className="cj-input" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); clearError('endDate') }}
                    aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? 'cj-end-error' : undefined} />
                </Field>
              </div>
              <p className={`cj-duration${duration.ok ? '' : ' is-muted'}`} aria-live="polite">
                {duration.ok ? duration.label : duration.error === 'order' ? '返回日期早于出发日期' : '选择日期后显示旅行天数'}
              </p>
              <Field label="同行人数" htmlFor="cj-travelers" labelId="cj-travelers-label">
                <TravelerStepper value={travelers} onStep={d => { setTravelers(t => Math.min(TRAVELERS_MAX, Math.max(TRAVELERS_MIN, t + d))); clearError('travelers') }} error={errors.travelers} />
              </Field>
            </Step>

            <Step n="03" title="准备这趟旅行" hint="创建后自动就绪，不需要额外设置。">
              <SetupItems official={official && joinOfficial ? official : null} />
            </Step>

            <section className="cj-final" aria-label="创建摘要">
              <CreateSummary title={title} destination={destination} startDate={startDate} endDate={endDate} travelers={travelers} joinOfficial={joinOfficial} />
              {submitError && <p className="cj-submit-error" role="alert"><TriangleAlert size={15} aria-hidden="true" /> {submitError}</p>}
              <div className="cj-actionbar">
                <button type="submit" className="cj-cta" disabled={busy || Boolean(limit)} aria-busy={busy}>
                  {busy ? <><Loader2 size={17} className="cj-spin" /> 正在创建…</> : <>创建旅行 <ArrowRight size={17} /></>}
                </button>
              </div>
            </section>
          </form>
        </div>
      </section>

      {created && <JourneySuccess trip={created.trip} officialAdded={created.officialAdded} onGo={() => { window.clearTimeout(goTimer.current); router.push(`/trips/${created.trip.id}`) }} />}
    </main>
  )
}

function Step({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="cj-step" aria-labelledby={`cj-step-${n}`}>
      <header>
        <span className="cj-step-no" aria-hidden="true">{n}</span>
        <div><h2 id={`cj-step-${n}`}>{title}</h2>{hint && <p>{hint}</p>}</div>
      </header>
      <div className="cj-step-body">{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, labelId, error, children }: { label: string; htmlFor: string; labelId?: string; error?: string; children: ReactNode }) {
  return (
    <div className="cj-field">
      {/* labelId：给按钮组（Stepper）作 aria-labelledby 的组标签，不是某个输入框的 label */}
      {labelId ? <span className="cj-label" id={labelId}>{label}</span> : <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error && <p id={`${htmlFor}-error`} className="cj-error" role="alert">⚠ {error}</p>}
    </div>
  )
}
