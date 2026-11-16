'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '@/services/admin'
import { type PermissionDraft } from '@/utils/admin-users'
import { patchedPermissions, writeUserBatch, type PermissionPatch, type UserWriteResult } from '@/utils/admin-batch'
import { AdminDialog } from './AdminDialog'
import { useAdminResource } from './useAdminResource'
import styles from './admin.module.css'

export type BulkOperation = 'permissions' | 'activate' | 'disable'
export type BulkEditorConfig = { ids: number[]; operation: BulkOperation }

export function BulkUserEditor({ config, onClose, onDirtyChange, onSavingChange, onDone }: {
  config: BulkEditorConfig; onClose: () => void; onDirtyChange: (dirty: boolean) => void
  onSavingChange: (saving: boolean) => void; onDone: (results: UserWriteResult[]) => Promise<void>
}) {
  const [ids, setIds] = useState(config.ids)
  const loader = useCallback((signal: AbortSignal) => Promise.all(ids.map(id => adminApi.user(id, signal))), [ids])
  const users = useAdminResource(loader, true)
  const [draft, setDraft] = useState<PermissionDraft>({ userLevel: '基础用户', tripLimit: '20', tripRetentionMonths: '1', canShare: true, canVideo: true, customMusicAccess: 'INHERIT', status: config.operation === 'disable' ? 'DISABLED' : 'ACTIVE' })
  const [fields, setFields] = useState<Set<keyof PermissionDraft>>(() => new Set(config.operation === 'permissions' ? [] : ['status']))
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [error, setError] = useState('')
  const [results, setResults] = useState<UserWriteResult[] | null>(null)
  const dirty = fields.size > 0 && !results
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  const title = config.operation === 'permissions' ? '批量修改权限' : config.operation === 'activate' ? '启用账号' : '停用账号'
  function enable(key: keyof PermissionDraft, checked: boolean) {
    setFields(previous => { const next = new Set(previous); if (checked) next.add(key); else next.delete(key); return next })
    setResults(null)
    setError('')
  }
  function value<K extends keyof PermissionDraft>(key: K, next: PermissionDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: next })); setResults(null); setError('')
  }
  function patch(): PermissionPatch {
    if ((fields.has('tripLimit') && !/^\d+$/.test(draft.tripLimit)) || (fields.has('tripRetentionMonths') && !/^\d+$/.test(draft.tripRetentionMonths))) throw new Error('旅程上限和保留月数须为整数。')
    return {
      ...(fields.has('userLevel') ? { userLevel: draft.userLevel.trim() } : {}),
      ...(fields.has('tripLimit') ? { tripLimit: Number(draft.tripLimit) } : {}),
      ...(fields.has('tripRetentionMonths') ? { tripRetentionMonths: Number(draft.tripRetentionMonths) } : {}),
      ...(fields.has('canShare') ? { canShare: draft.canShare } : {}),
      ...(fields.has('canVideo') ? { canVideo: draft.canVideo } : {}),
      ...(fields.has('customMusicAccess') ? { customMusicAccess: draft.customMusicAccess } : {}),
      ...(fields.has('status') ? { status: draft.status } : {}),
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      if (!fields.size) throw new Error('请至少勾选一项要修改的权限。')
      if (!users.data?.length || users.loading || !snapshotsCurrent) throw new Error('请先等待用户资料加载完成。')
      const update = patch()
      for (const user of users.data) patchedPermissions(user, update)
      setError(''); setConfirm(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '请检查输入。') }
  }
  async function save() {
    if (saving || !users.data || !snapshotsCurrent) return
    setConfirm(false); setSaving(true); onSavingChange(true); setError(''); setCompleted(0)
    try {
      const outcome = await writeUserBatch(users.data, patch(), adminApi.updateUser, setCompleted)
      setResults(outcome)
      onDirtyChange(false)
      await onDone(outcome)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '操作未完成。') }
    finally { setSaving(false); onSavingChange(false) }
  }
  const shorten = users.data?.filter(user => fields.has('tripRetentionMonths') && Number(draft.tripRetentionMonths) < user.tripRetentionMonths).length ?? 0
  const disabling = users.data?.filter(user => fields.has('status') && draft.status === 'DISABLED' && user.status !== 'DISABLED').length ?? 0
  const failed = results?.filter(result => !result.saved) ?? []
  const snapshotsCurrent = !!users.data && users.data.length === ids.length && users.data.every((user, index) => user.id === ids[index])
  return <>
    <AdminDialog title={`${title} · ${ids.length} 人`} onClose={onClose}>
      <p className={styles.bulkIntro}>只修改勾选的字段，其他设置保持各账号原值。逐人执行并分别报告结果；每次最多 50 人。</p>
      {snapshotsCurrent && <details className={styles.selectionPreview}><summary>查看所选 {users.data!.length} 个账号</summary><ul>{users.data!.map(user => <li key={user.id}>{user.nickname} · {user.email}</li>)}</ul></details>}
      {users.loading && <p role="status">正在读取最新用户资料…</p>}
      {users.error && <div className={styles.error} role="alert">{users.error}<button className={styles.button} onClick={() => void users.load()}>重试资料</button></div>}
      <form onSubmit={submit} className={styles.bulkForm}>
        {config.operation === 'permissions' && <>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('userLevel')} disabled={saving} onChange={event => enable('userLevel', event.target.checked)} />修改用户等级</span><input name="bulkUserLevel" maxLength={40} disabled={!fields.has('userLevel') || saving} value={draft.userLevel} onChange={event => value('userLevel', event.target.value)} /></label>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('tripLimit')} disabled={saving} onChange={event => enable('tripLimit', event.target.checked)} />修改旅程上限</span><input name="bulkTripLimit" type="number" min={1} max={100000} disabled={!fields.has('tripLimit') || saving} value={draft.tripLimit} onChange={event => value('tripLimit', event.target.value)} /></label>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('tripRetentionMonths')} disabled={saving} onChange={event => enable('tripRetentionMonths', event.target.checked)} />修改保留月数</span><input name="bulkRetentionMonths" type="number" min={1} max={1200} disabled={!fields.has('tripRetentionMonths') || saving} value={draft.tripRetentionMonths} onChange={event => value('tripRetentionMonths', event.target.value)} /></label>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('canShare')} disabled={saving} onChange={event => enable('canShare', event.target.checked)} />修改公开分享</span><select disabled={!fields.has('canShare') || saving} value={String(draft.canShare)} onChange={event => value('canShare', event.target.value === 'true')}><option value="true">允许公开分享</option><option value="false">关闭公开分享</option></select></label>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('canVideo')} disabled={saving} onChange={event => enable('canVideo', event.target.checked)} />修改制作视频</span><select disabled={!fields.has('canVideo') || saving} value={String(draft.canVideo)} onChange={event => value('canVideo', event.target.value === 'true')}><option value="true">允许制作视频</option><option value="false">关闭制作视频</option></select></label>
          <label className={styles.bulkField}><span><input type="checkbox" checked={fields.has('customMusicAccess')} disabled={saving} onChange={event => enable('customMusicAccess', event.target.checked)} />修改自定义音乐</span><select disabled={!fields.has('customMusicAccess') || saving} value={draft.customMusicAccess} onChange={event => value('customMusicAccess', event.target.value as PermissionDraft['customMusicAccess'])}><option value="INHERIT">按会员权益</option><option value="ALLOW">管理员开通</option><option value="DENY">停用此功能</option></select></label>
        </>}
        {config.operation !== 'permissions' && <p>将为所选 {ids.length} 个账号{config.operation === 'activate' ? '恢复正常使用' : '停用登录并撤销全部设备会话'}，不删除账号或旅程。</p>}
        {error && <div className={styles.error} role="alert">{error}</div>}
        {saving && <p role="status">正在执行 {completed} / {ids.length}，请勿关闭页面…</p>}
        {results && <div className={styles.bulkResults} role="status"><strong>{results.filter(result => result.saved).length} 项成功，{failed.length} 项未完成</strong>{failed.map(result => <p key={result.user.id}>{result.error}</p>)}{failed.length > 0 && <button type="button" className={styles.button} onClick={() => { setIds(failed.map(result => result.user.id)); setResults(null) }}>重新加载失败用户后重试</button>}</div>}
        <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={saving} onClick={onClose}>{results ? '完成' : '取消'}</button><button className={config.operation === 'disable' ? styles.dangerButton : styles.primaryButton} disabled={saving || users.loading || !snapshotsCurrent || !!users.error || !fields.size || !!results}>{saving ? '正在执行…' : '检查并继续'}</button></div>
      </form>
    </AdminDialog>
    {confirm && <AdminDialog title="确认批量操作" onClose={() => setConfirm(false)}><p>将对 {users.data?.length ?? 0} 个用户执行「{title}」。每个账号单独校验并保存，可能部分成功。</p>{shorten > 0 && <p className={styles.bulkRisk}>其中 {shorten} 个账号的保留期限将缩短，已有旅程可能立即到期并进入自动清理。已过期数据不会恢复。</p>}{disabling > 0 && <p className={styles.bulkRisk}>其中 {disabling} 个账号将被停用，所有设备会话立即撤销。</p>}<div className={styles.dialogActions}><button className={styles.button} onClick={() => setConfirm(false)}>继续编辑</button><button className={shorten || disabling ? styles.dangerButton : styles.primaryButton} onClick={() => void save()}>确认执行（{users.data?.length ?? 0} 人）</button></div></AdminDialog>}
  </>
}
