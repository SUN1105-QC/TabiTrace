'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { AlertTriangle, Copy, Pencil, Save } from 'lucide-react'
import { adminApi, type AdminUser } from '@/services/admin'
import { ApiError } from '@/services/api'
import { permissionDraft, permissionRisks, permissionsInput, validatePermissions, type PermissionDraft } from '@/utils/admin-users'
import { AdminDialog } from './AdminDialog'
import styles from './admin.module.css'

const subscribeViewport = (listener: () => void) => {
  const media = window.matchMedia('(max-width: 767px)')
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export function UserPermissionsEditor({ user, visible, onCancel, onReload, onSaved, onDirtyChange, onSavingChange }: {
  user: AdminUser; visible: boolean; onCancel: () => void; onReload: () => void
  onSaved: (user: AdminUser) => Promise<void>; onDirtyChange: (dirty: boolean) => void; onSavingChange: (saving: boolean) => void
}) {
  const [draft, setDraft] = useState(() => permissionDraft(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [risks, setRisks] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const levelsId = useId()
  const panel = useRef<HTMLElement>(null)
  const mobile = useSyncExternalStore(subscribeViewport, () => window.matchMedia('(max-width: 767px)').matches, () => false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(permissionDraft(user))
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { if (!mobile) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [user.id, mobile])
  const field = useCallback(<K extends keyof PermissionDraft>(key: K, value: PermissionDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }))
    setError('')
  }, [])

  async function save() {
    if (saving || !dirty) return
    const validation = validatePermissions(draft)
    if (validation) { setError(validation); return }
    setRisks(null)
    setSaving(true)
    onSavingChange(true)
    setError('')
    setConflict(false)
    try {
      const saved = await adminApi.updateUser(user.id, permissionsInput(draft, user))
      // 成功提示只来自写接口的真实成功；列表刷新失败由各模块单独展示。
      await onSaved(saved)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败，请重试；已填写内容保留。')
      setConflict(failure instanceof ApiError && failure.status === 409)
    } finally {
      setSaving(false)
      onSavingChange(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validatePermissions(draft)
    if (validation) { setError(validation); return }
    const nextRisks = permissionRisks(draft, user)
    if (nextRisks.length) setRisks(nextRisks)
    else void save()
  }
  const content = <form onSubmit={submit} noValidate aria-label="用户权限表单" className={styles.editorForm}>
    <div className={styles.editorIdentity}><span>{user.nickname}</span><button type="button" className={styles.copyId} onClick={async () => { try { await navigator.clipboard.writeText(String(user.id)); setCopied(true) } catch { setError(`复制不可用，请手动复制用户 ID：${user.id}`) } }}><Copy size={12} />{copied ? 'ID 已复制' : `ID ${user.id}`}</button></div>
    <fieldset disabled={saving || user.status === 'DELETION_PENDING'} className={styles.policyFields}>
      <legend className={styles.srOnly}>用户等级与配额</legend>
      <label>用户等级<input name="userLevel" list={levelsId} maxLength={40} value={draft.userLevel} onChange={event => field('userLevel', event.target.value)} /><datalist id={levelsId}><option value="基础用户" />{user.userLevel !== '基础用户' && <option value={user.userLevel} />}</datalist></label>
      <label>旅程上限<input name="tripLimit" type="number" inputMode="numeric" min={1} max={100000} step={1} value={draft.tripLimit} onChange={event => field('tripLimit', event.target.value)} aria-describedby={`${levelsId}-quota`} /><span className={styles.srOnly} id={`${levelsId}-quota`}>当前 {user.trips} 条有效旅程，允许 1 到 100000 条。</span></label>
      <label>保留月数<input name="tripRetentionMonths" type="number" inputMode="numeric" min={1} max={1200} step={1} value={draft.tripRetentionMonths} onChange={event => field('tripRetentionMonths', event.target.value)} aria-describedby={`${levelsId}-months`} /><span className={styles.srOnly} id={`${levelsId}-months`}>允许 1 到 1200 个自然月。</span></label>
    </fieldset>
    <p className={styles.retentionNote}><AlertTriangle size={14} />保留时间从每段旅程的创建时刻起算；已过期的数据不会恢复。缩短期限可能使已有旅程立即到期并进入自动清理；减少配额不会删除已有旅程，超出配额时暂停新建。</p>
    <div className={styles.editorLower}>
      <fieldset disabled={saving || user.status === 'DELETION_PENDING'} className={styles.featureFields}>
        <legend>功能权限</legend>
        <div className={styles.featureChecks}>
          <label><input type="checkbox" name="canShare" checked={draft.canShare} onChange={event => field('canShare', event.target.checked)} />公开分享</label>
          <label><input type="checkbox" name="canVideo" checked={draft.canVideo} onChange={event => field('canVideo', event.target.checked)} />制作视频</label>
          <label title="勾选为管理员开通，取消为停用；按会员权益可通过右侧选择器设置。"><input type="checkbox" name="customMusicOverride" checked={draft.customMusicAccess === 'ALLOW'} aria-checked={draft.customMusicAccess === 'INHERIT' ? 'mixed' : draft.customMusicAccess === 'ALLOW'} ref={element => { if (element) element.indeterminate = draft.customMusicAccess === 'INHERIT' }} onChange={event => field('customMusicAccess', event.target.checked ? 'ALLOW' : 'DENY')} />自定义音乐</label>
          <select name="customMusicAccess" aria-label="自定义音乐策略" value={draft.customMusicAccess} onChange={event => field('customMusicAccess', event.target.value as PermissionDraft['customMusicAccess'])}><option value="INHERIT">按会员权益</option><option value="ALLOW">管理员开通</option><option value="DENY">停用此功能</option></select>
        </div>
      </fieldset>
      <fieldset disabled={saving || user.status === 'DELETION_PENDING'} className={styles.accountField}>
        <legend>账号状态</legend>
        <label className={styles.statusSelect} data-status={draft.status}><span aria-hidden="true" /><select name="status" aria-label="账号状态" value={draft.status} onChange={event => field('status', event.target.value as PermissionDraft['status'])}><option value="ACTIVE">正常使用</option><option value="DISABLED">停用账号</option></select></label>
      </fieldset>
    </div>
    {error && <div role="alert" className={styles.error}>{error}{conflict && <button type="button" className={styles.button} onClick={onReload}>重新加载最新资料</button>}</div>}
    <div className={styles.saveActions}><button className={styles.primaryButton} disabled={!dirty || saving || user.status === 'DELETION_PENDING'}><Save size={16} />{saving ? '正在保存…' : '保存权限'}</button><button type="button" className={styles.button} disabled={saving} onClick={onCancel}>取消</button><span role="status">{dirty ? '有未保存的修改' : '与已保存资料一致'}</span></div>
  </form>

  return <>
    {mobile && visible ? <AdminDialog title={`编辑用户权限 · ${user.nickname}`} onClose={onCancel} fullScreen>{content}</AdminDialog>
      : <section hidden={!visible} ref={panel} className={styles.editorPanel} aria-label="编辑用户权限"><div className={styles.panelHeading}><Pencil size={20} /><h2>编辑用户权限 <span>· {user.email}</span></h2></div>{content}</section>}
    {risks && <AdminDialog title="确认权限变更" onClose={() => setRisks(null)}><p>即将修改「{user.nickname}」的账号设置：</p><ul className={styles.riskList}>{risks.map(risk => <li key={risk}>{risk}</li>)}</ul><div className={styles.dialogActions}><button className={styles.button} onClick={() => setRisks(null)}>继续编辑</button><button className={styles.dangerButton} onClick={() => void save()}>确认变更并保存</button></div></AdminDialog>}
  </>
}
