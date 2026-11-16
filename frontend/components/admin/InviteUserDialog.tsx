'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { adminModules } from '@/services/admin-modules'
import { AdminDialog } from './AdminDialog'
import styles from './admin.module.css'

export function InviteUserDialog({ onClose, onDirty, onSaving }: { onClose: () => void; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void }) {
  const [email,setEmail] = useState('')
  const [nickname,setNickname] = useState('')
  const [saving,setSaving] = useState(false)
  const [sent,setSent] = useState(false)
  const [error,setError] = useState('')
  useEffect(() => { onDirty(!sent && (!!email || !!nickname)) }, [email,nickname,sent,onDirty])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return
    setSaving(true); onSaving(true); setError('')
    try { await adminModules.invite(email.trim(),nickname.trim()); setSent(true); onDirty(false) }
    catch (failure) { setError(failure instanceof Error ? failure.message : '邀请未发送，请重试。') }
    finally { setSaving(false); onSaving(false) }
  }
  return <AdminDialog title="新增用户 · 邮箱邀请" onClose={onClose}>
    <p>向用户发送真实注册邀请。对方验证邮箱并设置密码后才会创建账号，可在「注册邀请」查看进度、重发或撤销。</p>
    <p className={styles.registrationNote}>邀请用于引导公开注册；撤销邀请不会禁止该邮箱自行注册。管理员不能代设密码或跳过验证。</p>
    {sent ? <div className={styles.notice} role="status">邀请邮件已发送至 {email}。用户完成注册后会出现在普通用户列表。</div> : <form className={styles.moduleForm} onSubmit={submit}>
      <label>用户邮箱<input name="inviteEmail" type="email" maxLength={255} required disabled={saving} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>用户称呼<input name="inviteNickname" maxLength={30} required disabled={saving} value={nickname} onChange={e => setNickname(e.target.value)} /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={saving} onClick={onClose}>取消</button><button className={styles.primaryButton} disabled={saving}>{saving ? '正在发送…' : '发送注册邀请'}</button></div>
    </form>}
    {sent && <div className={styles.dialogActions}><button className={styles.primaryButton} onClick={onClose}>完成</button></div>}
  </AdminDialog>
}
