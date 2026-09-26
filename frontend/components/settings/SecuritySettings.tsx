'use client'

/**
 * 账户与安全：旅迹只有“邮箱 + 密码”一种登录方式，因此显示修改密码而不是第三方账号绑定。
 * 已登录设备来自有效的 refresh token（每台设备一条），支持退出单台或全部其他设备。
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Laptop, Loader2, LogOut, Smartphone, TriangleAlert } from 'lucide-react'
import { authApi, userApi, type SessionView, type UserView } from '@/services/tabitrace-api'
import { PASSWORD_MIN, sessionTime } from '@/utils/settings'
import { ConfirmDialog, SettingsRow, SettingsSection } from './SettingsParts'

const COLLAPSED = 5

export function SecuritySettings({ user, onToast }: { user: UserView; onToast: (msg: string) => void }) {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionView[] | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'others' | 'logout' | null>(null)
  const [pwOpen, setPwOpen] = useState(false)

  const loadSessions = useCallback(async () => {
    setSessionError('')
    try { setSessions(await userApi.sessions()) } catch (e) { setSessionError(e instanceof Error && e.message ? e.message : '加载失败') }
  }, [])
  useEffect(() => { void loadSessions() }, [loadSessions])

  const others = sessions?.filter(s => !s.current) ?? []
  const visible = sessions ? (showAll ? sessions : sessions.slice(0, COLLAPSED)) : []

  const revokeOne = async (s: SessionView) => {
    setBusy(`s-${s.id}`)
    try { await userApi.revokeSession(s.id); onToast(`已退出 ${s.device}`); await loadSessions() }
    catch (e) { onToast(e instanceof Error && e.message ? e.message : '操作失败，请重试') }
    finally { setBusy(null) }
  }

  const revokeOthers = async () => {
    setConfirm(null)
    setBusy('others')
    try { const r = await userApi.revokeOtherSessions(); onToast(`已退出其他 ${r.signedOutSessions} 台设备`); await loadSessions() }
    catch (e) { onToast(e instanceof Error && e.message ? e.message : '操作失败，请重试') }
    finally { setBusy(null) }
  }

  const logout = async () => {
    setConfirm(null)
    setBusy('logout')
    try { await authApi.logout() } catch { /* 本地凭证已清理，照常离开 */ }
    localStorage.removeItem('tabitrace-live-trip-id')
    router.replace('/login')
  }

  return (
    <>
      <SettingsSection title="登录方式">
        <SettingsRow label="登录邮箱" description="旅迹使用“邮箱 + 密码”登录，暂未接入第三方账号登录。">
          <span className="st-status">{user.email}</span>
        </SettingsRow>
        <SettingsRow label="密码" description="修改后，除当前设备外的其他设备需要重新登录。" stack={pwOpen}>
          {pwOpen
            ? <PasswordForm onCancel={() => setPwOpen(false)} onDone={n => { setPwOpen(false); onToast(n > 0 ? `密码已更新，已退出其他 ${n} 台设备` : '密码已更新'); void loadSessions() }} />
            : <button type="button" className="st-btn" onClick={() => setPwOpen(true)}><KeyRound size={14} /> 修改密码</button>}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="已登录设备"
        description="退出后，那台设备最长会在 15 分钟内失去访问权限。"
        action={others.length > 0 ? (
          <button type="button" className="st-btn is-quiet" onClick={() => setConfirm('others')} disabled={busy !== null}>
            {busy === 'others' ? <Loader2 size={14} className="st-spin" /> : null} 退出其他设备（{others.length}）
          </button>
        ) : undefined}
      >
        {sessionError ? (
          <div className="st-inline-error" role="alert">
            <TriangleAlert size={15} /> 已登录设备加载失败：{sessionError}
            <button type="button" className="st-link" onClick={() => void loadSessions()}>重试</button>
          </div>
        ) : !sessions ? (
          <div className="st-session-skeleton" aria-busy="true" aria-label="正在加载已登录设备">{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 46, borderRadius: 12 }} />)}</div>
        ) : (
          <ul className="st-sessions">
            {visible.map(s => (
              <li key={s.id} className={s.current ? 'is-current' : ''}>
                <span className="st-session-icon" aria-hidden="true">{s.mobile ? <Smartphone size={16} /> : <Laptop size={16} />}</span>
                <div className="st-session-text">
                  <b>{s.device}{s.current && <em>当前设备</em>}</b>
                  <small>登录于 {sessionTime(s.signedInAt)} · 最近活动 {sessionTime(s.lastActiveAt)}</small>
                </div>
                {!s.current && (
                  <button type="button" className="st-link" onClick={() => void revokeOne(s)} disabled={busy !== null} aria-label={`退出 ${s.device}（登录于 ${sessionTime(s.signedInAt)}）`}>
                    {busy === `s-${s.id}` ? '退出中…' : '退出'}
                  </button>
                )}
              </li>
            ))}
            {sessions.length > COLLAPSED && (
              <li className="st-sessions-more">
                <button type="button" className="st-link" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
                  {showAll ? '收起' : `显示全部 ${sessions.length} 台设备`}
                </button>
              </li>
            )}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="退出登录">
        <SettingsRow label="退出当前账户" description="只退出这台设备，其他设备保持登录。">
          <button type="button" className="st-btn" onClick={() => setConfirm('logout')} disabled={busy !== null}>
            <LogOut size={14} /> {busy === 'logout' ? '正在退出…' : '退出当前账户'}
          </button>
        </SettingsRow>
      </SettingsSection>

      <DangerZone />

      {confirm === 'others' && (
        <ConfirmDialog
          title="退出其他设备？"
          body={<p>将退出除当前设备外的 {others.length} 台设备，它们需要重新输入密码登录。</p>}
          onCancel={() => setConfirm(null)}
          actions={<>
            <button type="button" className="st-btn" onClick={() => setConfirm(null)}>取消</button>
            <button type="button" className="st-btn is-primary" onClick={() => void revokeOthers()}>退出其他设备</button>
          </>}
        />
      )}
      {confirm === 'logout' && (
        <ConfirmDialog
          title="退出当前账户？"
          body={<p>退出后需要重新登录才能继续记录旅行。</p>}
          onCancel={() => setConfirm(null)}
          actions={<>
            <button type="button" className="st-btn" onClick={() => setConfirm(null)}>取消</button>
            <button type="button" className="st-btn is-primary" onClick={() => void logout()}>退出登录</button>
          </>}
        />
      )}
    </>
  )
}

function PasswordForm({ onCancel, onDone }: { onCancel: () => void; onDone: (signedOut: number) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<{ field: 'current' | 'next' | 'again'; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!current) { setError({ field: 'current', msg: '请输入当前密码' }); return }
    if (next.length < PASSWORD_MIN) { setError({ field: 'next', msg: `新密码至少 ${PASSWORD_MIN} 位` }); return }
    if (next === current) { setError({ field: 'next', msg: '新密码不能与当前密码相同' }); return }
    if (next !== again) { setError({ field: 'again', msg: '两次输入的新密码不一致' }); return }
    setSaving(true)
    try {
      const r = await userApi.changePassword(current, next)
      onDone(r.signedOutSessions)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : '密码修改失败，请重试'
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
      {field('current', '当前密码', current, setCurrent, 'current-password')}
      {field('next', `新密码（至少 ${PASSWORD_MIN} 位）`, next, setNext, 'new-password')}
      {field('again', '再次输入新密码', again, setAgain, 'new-password')}
      {error && <p className="st-field-error" id="st-pw-error" role="alert">⚠ {error.msg}</p>}
      <div className="st-pw-actions">
        <button type="button" className="st-btn is-quiet" onClick={onCancel} disabled={saving}>取消</button>
        <button type="submit" className="st-btn is-primary" disabled={saving}>{saving ? '保存中…' : '更新密码'}</button>
      </div>
    </form>
  )
}

/** 账户删除需要同时清理旅行、照片与视频文件，并处理支付记录的保留要求；在这些都确定之前不开放，也不做“只删用户行”的假删除 */
function DangerZone() {
  return (
    <SettingsSection title="危险操作" tone="danger">
      <SettingsRow
        label="删除账户"
        description="删除账户会永久移除你的旅行、打卡、照片、Travel Story 和分享链接，且不可恢复。由于还需要同时清理云端文件并处理支付记录的保留要求，在线删除暂未开放。"
      >
        <button type="button" className="st-btn is-danger" disabled aria-disabled="true">暂未开放</button>
      </SettingsRow>
    </SettingsSection>
  )
}
