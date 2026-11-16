'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { adminApi, type AdminPageResult, type SupportMessage } from '@/services/admin'
import { AdminPagination } from './AdminUsersTable'
import styles from './admin.module.css'

function messageDate(value: string) {
  // 数据库存储 UTC，后端 LocalDateTime 没有时区后缀；明确补 UTC 后再按东京显示。
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? '时间不可用' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo', hour12: false })
}

function ReplyCard({ message, onSaved, onDirty }: { message: SupportMessage; onSaved: () => Promise<void>; onDirty: (id: number, dirty: boolean) => void }) {
  const [reply, setReply] = useState(message.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = reply !== (message.reply ?? '')
  useEffect(() => { onDirty(message.id, dirty) }, [message.id, dirty, onDirty])
  async function send(event: FormEvent) {
    event.preventDefault()
    if (saving || !reply.trim()) return
    setSaving(true)
    setError('')
    try {
      await adminApi.reply(message.id, reply.trim())
      onDirty(message.id, false)
      await onSaved()
    } catch (failure) { setError(failure instanceof Error ? failure.message : '回复失败，请重试。') }
    finally { setSaving(false) }
  }
  return <article className={styles.messageCard}><div className={styles.messageHeading}><h3>{message.subject}</h3><span className={styles.statusBadge} data-status={message.status === 'OPEN' ? 'DELETION_PENDING' : 'ACTIVE'}>{message.status === 'OPEN' ? '待回复' : '已回复'}</span></div><p className={styles.messageMeta}>{message.nickname} · {message.email} · {messageDate(message.createdAt)}（东京）</p><p className={styles.messageContent}>{message.content}</p>
    <form onSubmit={send}><label htmlFor={`reply-${message.id}`}>管理员回复</label><textarea id={`reply-${message.id}`} maxLength={5000} rows={3} value={reply} disabled={saving} onChange={event => setReply(event.target.value)} />{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.replyActions}><small>{message.repliedAt ? `上次回复：${messageDate(message.repliedAt)}` : '回复后用户可在留言页面查看。'}</small><button className={styles.primaryButton} disabled={saving || !reply.trim() || !dirty}><Send size={15} />{saving ? '正在发送…' : message.reply ? '更新回复' : '发送回复'}</button></div></form>
  </article>
}

export function AdminMessages({ data, loading, error, page, status, onStatus, onPage, onRetry, onSaved, onDirty }: {
  data: AdminPageResult<SupportMessage> | null; loading: boolean; error: string; page: number; status: string
  onStatus: (status: string) => void; onPage: (page: number) => void; onRetry: () => void
  onSaved: () => Promise<void>; onDirty: (id: number, dirty: boolean) => void
}) {
  return <section className={styles.messagesSection} aria-label="留言管理" aria-busy={loading}>
    <div className={styles.toolbar}><div><h2>用户留言 <span className={styles.count}>{data?.total.toLocaleString('zh-CN') ?? '—'}</span></h2><p>阅读用户反馈，及时回复升级与备份申请。</p></div><label className={styles.messageFilter}>留言状态<select value={status} onChange={event => onStatus(event.target.value)}><option value="OPEN">待回复</option><option value="REPLIED">已回复</option><option value="">全部</option></select></label></div>
    {error && <div className={styles.error} role="alert">留言读取失败：{error}<button className={styles.button} onClick={onRetry}>重试留言</button></div>}
    {loading && <p className={styles.loadingLine} role="status">正在读取留言…</p>}
    {data?.items.map(message => <ReplyCard key={`${message.id}-${message.repliedAt ?? ''}`} message={message} onSaved={onSaved} onDirty={onDirty} />)}
    {!loading && !error && data?.items.length === 0 && <div className={styles.empty}><MessageSquare size={30} /><h3>{status === 'OPEN' ? '暂无待回复留言' : '暂无符合条件的留言'}</h3><p>用户提交的反馈与申请会显示在这里。</p></div>}
    <AdminPagination page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 25} loading={loading} onPage={onPage} />
  </section>
}
