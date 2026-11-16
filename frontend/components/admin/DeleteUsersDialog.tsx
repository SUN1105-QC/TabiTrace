'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/services/admin'
import { adminModules } from '@/services/admin-modules'
import { ApiError } from '@/services/api'
import type { UserWriteResult } from '@/utils/admin-batch'
import { AdminDialog } from './AdminDialog'
import { useAdminResource } from './useAdminResource'
import styles from './admin.module.css'

export function DeleteUsersDialog({ ids: initialIds, restore, onClose, onDirty, onSaving, onDone }: {
  ids: number[]; restore: boolean; onClose: () => void; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void; onDone: (results: UserWriteResult[]) => Promise<void>
}) {
  const [ids,setIds] = useState(initialIds)
  const fetcher = useCallback((signal: AbortSignal) => Promise.all(ids.map(id => adminApi.user(id,signal))), [ids])
  const resource = useAdminResource(fetcher,true)
  const [confirmation,setConfirmation] = useState('')
  const [saving,setSaving] = useState(false)
  const [results,setResults] = useState<UserWriteResult[] | null>(null)
  const [error,setError] = useState('')
  const [progress,setProgress] = useState(0)
  const expected = restore ? '撤销删除' : ids.length === 1 ? resource.data?.[0].email : `删除 ${ids.length} 个账号`
  const current = !!resource.data && resource.data.length === ids.length && resource.data.every((u,index) => u.id === ids[index])
  useEffect(() => { onDirty(!results && !!confirmation) }, [confirmation,results,onDirty])
  async function save() {
    if (saving || !current || !resource.data || !expected || confirmation.trim() !== expected) return
    setSaving(true);onSaving(true);setError('');setProgress(0)
    const outcome: UserWriteResult[] = []
    let stopped = ''
    try {
      for (const user of resource.data) {
        if (stopped) outcome.push({ user,error: stopped })
        else try {
          outcome.push({ user,saved: await (restore ? adminModules.restoreUser(user) : adminModules.deleteUser(user,user.email)) })
        } catch (failure) {
          outcome.push({ user,error: failure instanceof Error ? failure.message : '操作未完成。' })
          if (failure instanceof ApiError && [0,401,403,429].includes(failure.status)) stopped = '前序请求遇到连接、鉴权或限流错误，本项尚未执行。'
        }
        setProgress(outcome.length)
      }
      setResults(outcome);onDirty(false);await onDone(outcome)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '列表刷新失败。请重新查询账号状态。') }
    finally { setSaving(false);onSaving(false) }
  }
  const failed = results?.filter(r => !r.saved) ?? []
  return <AdminDialog title={`${restore ? '撤销用户删除' : '删除用户'} · ${ids.length} 人`} onClose={onClose}>
    <p className={styles.bulkRisk}>{restore ? '撤销后恢复删除前的账号状态；此前已停用的账号仍保持停用，所有旧设备会话继续失效。' : '立即撤销所有设备会话，账号进入 7 天冷静期。到期后永久删除账号、旅程、照片、视频和上传音乐。冷静期内可在列表中撤销；到期清理后的数据不能恢复。'}</p>
    {resource.loading && <p role="status">正在读取最新账号资料…</p>}
    {resource.error && <p className={styles.error} role="alert">{resource.error}<button className={styles.button} onClick={() => void resource.load()}>重新加载</button></p>}
    {current && <ul className={styles.deletionUsers}>{resource.data!.map(u => <li key={u.id}><strong>{u.nickname}</strong> · {u.email}{u.deletionScheduledAt && <small>计划清理：{new Date(`${u.deletionScheduledAt}Z`).toLocaleString('zh-CN')}</small>}</li>)}</ul>}
    {!results && <label className={styles.confirmField}>输入「{expected ?? '等待加载'}」确认<input name="deletionConfirmation" autoComplete="off" disabled={saving || !current} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}
    {saving && <p role="status">正在处理 {progress} / {ids.length}，请勿关闭页面。</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {results && <div role="status" className={styles.bulkResults}><strong>{results.filter(r => r.saved).length} 项成功，{failed.length} 项未完成</strong>{failed.map(r => <p key={r.user.id}>{r.user.email}：{r.error}</p>)}{failed.length > 0 && <button className={styles.button} onClick={() => { setIds(failed.map(r => r.user.id));setResults(null);setConfirmation('') }}>重新加载失败账号后重试</button>}</div>}
    <div className={styles.dialogActions}><button className={styles.button} disabled={saving} onClick={onClose}>{results ? '完成' : '取消'}</button>{!results && <button className={restore ? styles.primaryButton : styles.dangerButton} disabled={saving || resource.loading || !!resource.error || !current || confirmation.trim() !== expected} onClick={() => void save()}>{restore ? '确认撤销删除' : '确认安排删除'}</button>}</div>
  </AdminDialog>
}
