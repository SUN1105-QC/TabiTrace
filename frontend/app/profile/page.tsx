'use client'

/**
 * 个人设置 · Settings Center
 * 左侧账户概览 + 右侧分 Tab 设置。个人资料 / 旅行偏好 / 隐私共用一份草稿，手动保存（UnsavedChangesBar）；
 * 头像、通知开关、密码与设备管理是即时操作。有未保存修改时，切换 Tab、点击站内链接或关闭页面都会先确认。
 * Tab 用 ?tab= 记在地址栏里，刷新后停留在原来的 Tab。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCcw, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { AccountSummaryCard, AccountSummarySkeleton } from '@/components/settings/AccountSummaryCard'
import { ConfirmDialog } from '@/components/settings/SettingsParts'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { TravelPreferences } from '@/components/settings/TravelPreferences'
import { PrivacySettings } from '@/components/settings/PrivacySettings'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { SecuritySettings } from '@/components/settings/SecuritySettings'
import { ProSettings } from '@/components/settings/ProSettings'
import { UnsavedChangesBar } from '@/components/settings/UnsavedChangesBar'
import { ApiError } from '@/services/api'
import { userApi, type AccountOverview, type UserView } from '@/services/tabitrace-api'
import {
  SETTINGS_TABS, buildPayload, changedFields, draftFromUser, fieldOfError, isSettingsTab, validateDraft,
  type FieldErrors, type SettingsDraft, type SettingsTab
} from '@/utils/settings'

type Pending = { kind: 'tab'; tab: SettingsTab } | { kind: 'href'; href: string }

export default function PersonalSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserView | null>(null)
  const [overview, setOverview] = useState<AccountOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [initial, setInitial] = useState<SettingsDraft | null>(null)
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [u, o] = await Promise.all([userApi.me(), userApi.overview()])
      const d = draftFromUser(u)
      setUser(u); setOverview(o); setInitial(d); setDraft(d); setErrors({})
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : '请稍后再试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (isSettingsTab(q)) setTab(q)
    void load()
  }, [load])

  // 窄屏下 Tab 可横向滚动：保证当前 Tab 在可见范围内（只滚动 Tab 条本身，不带动页面）
  useEffect(() => {
    const el = tabRefs.current[tab]
    const nav = el?.parentElement
    if (!el || !nav || nav.scrollWidth <= nav.clientWidth) return
    if (el.offsetLeft < nav.scrollLeft || el.offsetLeft + el.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: el.offsetLeft - 12, behavior: 'smooth' })
    }
  }, [tab, loading])

  const dirtyKeys = useMemo(() => (initial && draft ? changedFields(initial, draft) : []), [initial, draft])
  const dirty = dirtyKeys.length > 0

  const goTab = useCallback((next: SettingsTab) => {
    setTab(next)
    window.history.replaceState(null, '', `${window.location.pathname}?tab=${next}`)
  }, [])

  const selectTab = (next: SettingsTab) => {
    if (next === tab) return
    if (dirty) setPending({ kind: 'tab', tab: next })
    else goTab(next)
  }

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = SETTINGS_TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + SETTINGS_TABS.length) % SETTINGS_TABS.length]
    tabRefs.current[next.key]?.focus()
  }

  const change = (patch: Partial<SettingsDraft>) => {
    setDraft(d => (d ? { ...d, ...patch } : d))
    setSaveError('')
    setErrors(prev => {
      const n = { ...prev }
      for (const k of Object.keys(patch)) delete n[k as keyof FieldErrors]
      return n
    })
  }

  /** 头像、通知等即时操作只改对应字段，不影响草稿里尚未保存的修改 */
  const applyUser = (u: UserView) => setUser(u)

  const save = async (): Promise<boolean> => {
    if (!initial || !draft) return false
    const invalid = validateDraft(draft)
    if (Object.keys(invalid).length) {
      setErrors(invalid)
      setSaveError('请先修改标出的字段')
      const first = invalid.nickname || invalid.bio ? 'profile' : 'preferences'
      if (first !== tab) goTab(first)
      return false
    }
    setSaving(true)
    setSaveError('')
    try {
      const u = await userApi.update(buildPayload(initial, draft))
      const d = draftFromUser(u)
      setUser(u); setInitial(d); setDraft(d); setErrors({})
      showToast('设置已保存')
      return true
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : '网络异常'
      const field = fieldOfError(e instanceof ApiError ? e.code : null)
      if (field) setErrors({ [field]: msg })
      setSaveError(msg)
      showToast('设置保存失败，请重试')
      return false
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setDraft(initial)
    setErrors({})
    setSaveError('')
  }

  const proceed = (p: Pending) => {
    setPending(null)
    if (p.kind === 'tab') goTab(p.tab)
    else router.push(p.href)
  }

  // 有未保存修改时：拦截站内链接跳转与关闭 / 刷新页面
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault()
      e.stopPropagation()
      setPending({ kind: 'href', href: url.pathname + url.search + url.hash })
    }
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', onUnload) }
  }, [dirty])

  if (loading) return <main><SiteHeader /><SettingsSkeleton /></main>

  if (loadError || !user || !overview || !draft) {
    return (
      <main>
        <SiteHeader />
        <div className="st-page">
          <div className="st-error" role="alert">
            <TriangleAlert size={22} />
            <p>个人设置加载失败</p>
            <small>{loadError || '请稍后再试'}</small>
            <button type="button" className="st-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        </div>
      </main>
    )
  }

  const current = SETTINGS_TABS.find(t => t.key === tab)!

  return (
    <main>
      <SiteHeader />
      <div className={`st-page${dirty ? ' has-unsaved' : ''}`}>
        <div className="st-layout">
          <header className="st-header">
            <p className="st-eyebrow">PERSONAL SETTINGS</p>
            <h1>个人设置</h1>
            <p>管理你的账户资料、旅行偏好、隐私和通知方式。</p>
          </header>

          <AccountSummaryCard user={user} overview={overview} onOpenProfile={() => selectTab('profile')} onOpenPro={() => selectTab('pro')} />

          <nav className="st-tabs" role="tablist" aria-label="设置分类">
            {SETTINGS_TABS.map((t, i) => (
              <button
                key={t.key}
                ref={el => { tabRefs.current[t.key] = el }}
                type="button"
                role="tab"
                id={`st-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="st-panel"
                tabIndex={tab === t.key ? 0 : -1}
                className={tab === t.key ? 'is-active' : ''}
                onClick={() => selectTab(t.key)}
                onKeyDown={e => onTabKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="st-panel" role="tabpanel" id="st-panel" aria-labelledby={`st-tab-${current.key}`}>
            {tab === 'profile' && <ProfileSettings user={user} draft={draft} errors={errors} onChange={change} onUserChange={applyUser} onToast={showToast} />}
            {tab === 'preferences' && <TravelPreferences draft={draft} errors={errors} onChange={change} />}
            {tab === 'privacy' && <PrivacySettings draft={draft} onChange={change} />}
            {tab === 'notifications' && <NotificationSettings user={user} onUserChange={applyUser} onToast={showToast} />}
            {tab === 'security' && <SecuritySettings user={user} onToast={showToast} />}
            {tab === 'pro' && <ProSettings overview={overview} />}
          </div>
        </div>

        {/* 浮层放在 .st-page 内：移动端全局样式会给 main 的直接子 div 加上下内边距 */}
        {dirty && <UnsavedChangesBar count={dirtyKeys.length} saving={saving} error={saveError} onCancel={discard} onSave={() => void save()} />}

        {pending && (
          <ConfirmDialog
            title="有尚未保存的更改"
            body={<p>离开前要保存这些更改吗？放弃后，修改将恢复为上次保存的内容。</p>}
            onCancel={() => setPending(null)}
            actions={<>
              <button type="button" className="st-btn is-quiet" onClick={() => setPending(null)}>取消</button>
              <button type="button" className="st-btn" onClick={() => { discard(); proceed(pending) }}>放弃更改</button>
              <button type="button" className="st-btn is-primary" disabled={saving} onClick={async () => { const p = pending; if (await save()) proceed(p); else setPending(null) }}>
                {saving ? '保存中…' : '保存更改'}
              </button>
            </>}
          />
        )}

        {toast && <div className="ts-toast" role="status" aria-live="polite">{toast}</div>}
      </div>
    </main>
  )
}

function SettingsSkeleton() {
  return (
    <div className="st-page" aria-busy="true" aria-label="正在加载个人设置">
      <div className="st-layout">
        <header className="st-header">
          <div className="skeleton" style={{ width: 140, height: 12, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 180, height: 36, borderRadius: 10, marginTop: 14 }} />
          <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 6, marginTop: 14 }} />
        </header>
        <AccountSummarySkeleton />
        <div className="st-tabs">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ width: 84, height: 34, borderRadius: 999 }} />)}</div>
        <div className="st-panel"><SettingsSectionSkeleton /></div>
      </div>
    </div>
  )
}

function SettingsSectionSkeleton() {
  return (
    <section className="st-section" aria-hidden="true">
      <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 8 }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="st-row">
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 90, height: 14, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '70%', height: 11, borderRadius: 6, marginTop: 8 }} />
          </div>
          <div className="skeleton" style={{ width: 220, height: 40, borderRadius: 12 }} />
        </div>
      ))}
    </section>
  )
}
