'use client'

/**
 * 账户与安全：旅迹只有“邮箱 + 密码”一种登录方式，因此显示修改密码而不是第三方账号绑定。
 * 已登录设备来自有效的 refresh token（每台设备一条），支持退出单台或全部其他设备。
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Laptop, Loader2, LogOut, Smartphone, Trash2, TriangleAlert } from 'lucide-react'
import { authApi, userApi, type SessionView, type UserView } from '@/services/tabitrace-api'
import { PASSWORD_MIN, sessionTime } from '@/utils/settings'
import { useT } from '@/components/common/PreferencesProvider'
import { ConfirmDialog, SettingsRow, SettingsSection } from './SettingsParts'

const COLLAPSED = 5

export function SecuritySettings({ user, onToast }: { user: UserView; onToast: (msg: string) => void }) {
  const t = useT()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionView[] | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'others' | 'logout' | null>(null)
  const [pwOpen, setPwOpen] = useState(false)

  const loadSessions = useCallback(async () => {
    setSessionError('')
    try { setSessions(await userApi.sessions()) } catch (e) { setSessionError(e instanceof Error && e.message ? e.message : t('common.operationFailed')) }
  }, [t])
  useEffect(() => { void loadSessions() }, [loadSessions])

  const others = sessions?.filter(s => !s.current) ?? []
  const visible = sessions ? (showAll ? sessions : sessions.slice(0, COLLAPSED)) : []

  const revokeOne = async (s: SessionView) => {
    setBusy(`s-${s.id}`)
    try { await userApi.revokeSession(s.id); onToast(t('settings.security.signedOutDevice', { device: s.device })); await loadSessions() }
    catch (e) { onToast(e instanceof Error && e.message ? e.message : t('common.operationFailed')) }
    finally { setBusy(null) }
  }

  const revokeOthers = async () => {
    setConfirm(null)
    setBusy('others')
    try { const r = await userApi.revokeOtherSessions(); onToast(t('settings.security.signedOutOthers', { count: r.signedOutSessions })); await loadSessions() }
    catch (e) { onToast(e instanceof Error && e.message ? e.message : t('common.operationFailed')) }
    finally { setBusy(null) }
  }

  const logout = async () => {
    setConfirm(null)
    setBusy('logout')
    try { await authApi.logout() } catch { /* 本地凭证已清理，照常离开 */ }
    router.replace('/login')
  }

  return (
    <>
      <SettingsSection title={t('settings.security.loginMethod')}>
        <SettingsRow label={t('settings.security.loginEmail')} description={t('settings.security.loginEmailDesc')}>
          <span className="st-status">{user.email}</span>
        </SettingsRow>
        <SettingsRow label={t('settings.security.password')} description={t('settings.security.passwordDesc')} stack={pwOpen}>
          {pwOpen
            ? <PasswordForm onCancel={() => setPwOpen(false)} onDone={n => { setPwOpen(false); onToast(n > 0 ? t('settings.security.passwordUpdatedOthers', { count: n }) : t('settings.security.passwordUpdated')); void loadSessions() }} />
            : <button type="button" className="st-btn" onClick={() => setPwOpen(true)}><KeyRound size={14} /> {t('settings.security.changePassword')}</button>}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title={t('settings.security.devices')}
        description={t('settings.security.devicesDesc')}
        action={others.length > 0 ? (
          <button type="button" className="st-btn is-quiet" onClick={() => setConfirm('others')} disabled={busy !== null}>
            {busy === 'others' ? <Loader2 size={14} className="st-spin" /> : null} {t('settings.security.signOutOthers', { count: others.length })}
          </button>
        ) : undefined}
      >
        {sessionError ? (
          <div className="st-inline-error" role="alert">
            <TriangleAlert size={15} /> {t('settings.security.devicesFailed', { error: sessionError })}
            <button type="button" className="st-link" onClick={() => void loadSessions()}>{t('common.retry')}</button>
          </div>
        ) : !sessions ? (
          <div className="st-session-skeleton" aria-busy="true" aria-label={t('settings.security.devicesLoading')}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 46, borderRadius: 12 }} />)}</div>
        ) : (
          <ul className="st-sessions">
            {visible.map(s => (
              <li key={s.id} className={s.current ? 'is-current' : ''}>
                <span className="st-session-icon" aria-hidden="true">{s.mobile ? <Smartphone size={16} /> : <Laptop size={16} />}</span>
                <div className="st-session-text">
                  <b>{s.device}{s.current && <em>{t('settings.security.currentDevice')}</em>}</b>
                  <small>{t('settings.security.deviceTimes', { signedIn: sessionTime(s.signedInAt), active: sessionTime(s.lastActiveAt) })}</small>
                </div>
                {!s.current && (
                  <button type="button" className="st-link" onClick={() => void revokeOne(s)} disabled={busy !== null} aria-label={t('settings.security.signOutDevice', { device: s.device, time: sessionTime(s.signedInAt) })}>
                    {busy === `s-${s.id}` ? t('settings.security.signingOut') : t('settings.security.signOut')}
                  </button>
                )}
              </li>
            ))}
            {sessions.length > COLLAPSED && (
              <li className="st-sessions-more">
                <button type="button" className="st-link" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
                  {showAll ? t('common.collapse') : t('settings.security.showAllDevices', { count: sessions.length })}
                </button>
              </li>
            )}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.security.logoutTitle')}>
        <SettingsRow label={t('settings.security.logoutRow')} description={t('settings.security.logoutDesc')}>
          <button type="button" className="st-btn" onClick={() => setConfirm('logout')} disabled={busy !== null}>
            <LogOut size={14} /> {busy === 'logout' ? t('settings.security.loggingOut') : t('settings.security.logoutRow')}
          </button>
        </SettingsRow>
      </SettingsSection>

      <DangerZone />

      {confirm === 'others' && (
        <ConfirmDialog
          title={t('settings.security.confirmOthersTitle')}
          body={<p>{t('settings.security.confirmOthersBody', { count: others.length })}</p>}
          onCancel={() => setConfirm(null)}
          actions={<>
            <button type="button" className="st-btn" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
            <button type="button" className="st-btn is-primary" onClick={() => void revokeOthers()}>{t('settings.security.signOutOthers', { count: others.length })}</button>
          </>}
        />
      )}
      {confirm === 'logout' && (
        <ConfirmDialog
          title={t('settings.security.confirmLogoutTitle')}
          body={<p>{t('settings.security.confirmLogoutBody')}</p>}
          onCancel={() => setConfirm(null)}
          actions={<>
            <button type="button" className="st-btn" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
            <button type="button" className="st-btn is-primary" onClick={() => void logout()}>{t('settings.security.logoutTitle')}</button>
          </>}
        />
      )}
    </>
  )
}

function PasswordForm({ onCancel, onDone }: { onCancel: () => void; onDone: (signedOut: number) => void }) {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<{ field: 'current' | 'next' | 'again'; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!current) { setError({ field: 'current', msg: t('settings.security.needCurrent') }); return }
    if (next.length < PASSWORD_MIN) { setError({ field: 'next', msg: t('settings.security.tooShort', { min: PASSWORD_MIN }) }); return }
    if (next === current) { setError({ field: 'next', msg: t('settings.security.sameAsCurrent') }); return }
    if (next !== again) { setError({ field: 'again', msg: t('settings.security.mismatch') }); return }
    setSaving(true)
    try {
      const r = await userApi.changePassword(current, next)
      onDone(r.signedOutSessions)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : t('settings.security.changeFailed')
      setError({ field: /当前密码/.test(msg) ? 'current' : 'next', msg })
    } finally {
      setSaving(false)
    }
  }

  const field = (id: 'current' | 'next' | 'again', label: string, value: string, set: (v: string) => void, auto: string) => (
    <label className="st-pw-field" htmlFor={`st-pw-${id}`}>
      <span>{label}</span>
      <input
        id={`st-pw-${id}`}
        type="password"
        className="st-input"
        value={value}
        onChange={e => set(e.target.value)}
        autoComplete={auto}
        aria-invalid={error?.field === id}
        aria-describedby={error?.field === id ? 'st-pw-error' : undefined}
      />
    </label>
  )

  return (
    <form className="st-pw-form" onSubmit={submit} noValidate>
      {field('current', t('settings.security.currentPassword'), current, setCurrent, 'current-password')}
      {field('next', t('settings.security.newPassword', { min: PASSWORD_MIN }), next, setNext, 'new-password')}
      {field('again', t('settings.security.againPassword'), again, setAgain, 'new-password')}
      {error && <p className="st-field-error" id="st-pw-error" role="alert">⚠ {error.msg}</p>}
      <div className="st-pw-actions">
        <button type="button" className="st-btn is-quiet" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
        <button type="submit" className="st-btn is-primary" disabled={saving}>{saving ? t('common.saving') : t('settings.security.updatePassword')}</button>
      </div>
    </form>
  )
}

/**
 * 注销账户：再次输入密码 + 勾选确认 → 进入 7 天冷静期（所有设备退出）→ 跳到登录页提示删除时间。
 * 冷静期内重新登录即可撤销；到期后由后端删除文件与数据，付款记录作为财务凭证保留。
 */
function DangerZone() {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [ack, setAck] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => { if (busy) return; setOpen(false); setPassword(''); setAck(false); setError('') }

  const submit = async () => {
    if (!password) { setError(t('settings.security.deleteNeedPassword')); return }
    if (!ack) { setError(t('settings.security.deleteNeedAck')); return }
    setBusy(true); setError('')
    try {
      const r = await userApi.requestDeletion(password)
      router.replace(`/login?accountDeletion=${encodeURIComponent(r.scheduledAt)}`)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('common.operationFailed'))
      setBusy(false)
    }
  }

  return (
    <SettingsSection title={t('settings.security.danger')} tone="danger">
      <SettingsRow label={t('settings.security.deleteAccount')} description={t('settings.security.deleteDesc')}>
        <button type="button" className="st-btn is-danger" onClick={() => setOpen(true)}><Trash2 size={14} /> {t('settings.security.deleteButton')}</button>
      </SettingsRow>
      {open && (
        <ConfirmDialog
          title={t('settings.security.deleteTitle')}
          onCancel={close}
          body={
            <form className="st-delete-form" onSubmit={e => { e.preventDefault(); void submit() }} noValidate>
              <p>{t('settings.security.deleteBody')}</p>
              <ul className="st-delete-list">
                <li>{t('settings.security.deleteItem1')}</li>
                <li>{t('settings.security.deleteItem2', { days: 7 })}</li>
                <li>{t('settings.security.deleteItem3')}</li>
                <li>{t('settings.security.deleteItem4')}</li>
              </ul>
              <label className="st-pw-field" htmlFor="st-delete-password">
                <span>{t('settings.security.deletePassword')}</span>
                <input id="st-delete-password" type="password" className="st-input" autoComplete="current-password" value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }} disabled={busy} aria-describedby={error ? 'st-delete-error' : undefined} />
              </label>
              <label className="st-delete-ack">
                <input type="checkbox" checked={ack} onChange={e => { setAck(e.target.checked); setError('') }} disabled={busy} />
                <span>{t('settings.security.deleteAck')}</span>
              </label>
              {error && <p className="st-field-error" id="st-delete-error" role="alert">⚠ {error}</p>}
            </form>
          }
          actions={<>
            <button type="button" className="st-btn" onClick={close} disabled={busy}>{t('common.cancel')}</button>
            <button type="button" className="st-btn is-danger-fill" onClick={() => void submit()} disabled={busy}>
              {busy ? <><Loader2 size={14} className="st-spin" /> {t('settings.security.deleting')}</> : t('settings.security.deleteSubmit')}
            </button>
          </>}
        />
      )}
    </SettingsSection>
  )
}
