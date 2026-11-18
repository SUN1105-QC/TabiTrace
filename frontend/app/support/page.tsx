'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, RefreshCw, Send } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { PageContainer } from '@/components/common/PageContainer'
import { TripExportButton, expiryLabel } from '@/components/trip/TripRetentionNotice'
import { supportApi, type SupportMessage } from '@/services/admin'
import { tripApi, userApi, type TripView, type UserView } from '@/services/tabitrace-api'

export default function SupportPage() {
  const [user, setUser] = useState<UserView | null>(null)
  const [trips, setTrips] = useState<TripView[]>([])
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [subject, setSubject] = useState('申请升级账号权限')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [u, t, m] = await Promise.all([userApi.me(), tripApi.list(), supportApi.messages()])
      setUser(u)
      setTrips(t)
      setMessages(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  async function send(e: FormEvent) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    setNotice('')
    try {
      const m = await supportApi.send(subject.trim(), content.trim())
      setMessages((rows) => [m, ...rows].slice(0, 100))
      setContent('')
      setNotice('留言已发送，管理员的回复会显示在下方。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败，请重试')
    } finally {
      setSending(false)
    }
  }
  return (
    <main>
      <SiteHeader />
      <PageContainer variant="narrow" className="space-y-6 pb-20 pt-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-warm">ACCOUNT & SUPPORT</p>
            <h1 className="mt-2 font-serif text-3xl">联系管理员</h1>
            <p className="mt-2 text-sm text-black/60">申请更多旅程名额、更长的保存期限，或开通需要的功能。</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm disabled:opacity-50"
          >
            <RefreshCw size={15} />
            刷新回复
          </button>
        </header>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
            {notice}
          </p>
        )}
        {loading && (
          <p role="status" className="text-sm text-black/60">
            正在读取账号与留言…
          </p>
        )}
        {user && (
          <section className="warm-card p-5">
            <h2 className="text-lg font-bold">当前权限 · {user.userLevel ?? '基础用户'}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <p>
                旅程：
                <b>
                  {trips.length} / {user.tripLimit ?? 20}
                </b>
              </p>
              <p>
                保留时间：<b>{user.tripRetentionMonths ?? 1} 个月</b>
              </p>
              <p>
                起算时间：<b>旅程创建时</b>
              </p>
            </div>
            <p className="mt-4 text-sm text-black/60">
              公开分享：{user.canShare === false ? '未开通' : '已开通'} · 视频制作：
              {user.canVideo === false ? '未开通' : '已开通'} · 自定义音乐：
              {user.customMusicAccess === 'ALLOW'
                ? '管理员已开通'
                : user.customMusicAccess === 'DENY'
                  ? '未开通'
                  : '按会员权益'}
            </p>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="warm-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Send size={19} />
              给管理员留言
            </h2>
            <form onSubmit={send} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">
                主题
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-black/15 bg-white p-3"
                />
              </label>
              <label className="block text-sm font-semibold">
                留言内容
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  maxLength={5000}
                  rows={7}
                  placeholder="请说明希望升级的旅程数量、保留月数、功能，以及其他需要帮助的问题。"
                  className="mt-2 w-full resize-y rounded-xl border border-black/15 bg-white p-3 font-normal"
                />
              </label>
              <p className="text-xs text-black/50">每天最多 10 条。只有你和管理员能看到这些留言。</p>
              <button
                disabled={sending || !subject.trim() || !content.trim()}
                className="warm-button disabled:opacity-50"
              >
                {sending ? '正在发送…' : '发送留言'}
              </button>
            </form>
          </section>
          <section className="warm-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <MessageSquare size={19} />
              我的留言与回复
            </h2>
            <div className="mt-5 max-h-[650px] space-y-4 overflow-y-auto">
              {messages.length === 0 && !loading && (
                <p className="py-8 text-sm text-black/50">还没有留言。发送后可在这里查看回复。</p>
              )}
              {messages.map((m) => (
                <article key={m.id} className="rounded-2xl border border-black/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="break-words font-bold">{m.subject}</h3>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs">
                      {m.status === 'REPLIED' ? '已回复' : '等待回复'}
                    </span>
                  </div>
                  <time className="mt-1 block text-xs text-black/50">{expiryLabel(m.createdAt)}</time>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{m.content}</p>
                  {m.reply && (
                    <div className="mt-4 rounded-xl bg-orange-50 p-3">
                      <b className="text-xs text-warm">管理员回复 · {expiryLabel(m.repliedAt)}</b>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
        <section className="warm-card p-5 sm:p-6">
          <h2 className="text-xl font-bold">旅程备份与到期时间</h2>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            到期后会自动删除旅程及相关照片、视频。备份 ZIP
            包含旅程、打卡、行程、地点和原始照片，请检查压缩包中的导出报告；已生成的视频请在视频页面另行下载。归档仍占用配额，且不会延长有效期。
          </p>
          <div className="mt-4 divide-y divide-black/10">
            {trips.map((t) => (
              <article key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <h3 className="break-words font-bold">{t.title}</h3>
                  <p className="mt-1 text-xs text-black/60">
                    创建：{expiryLabel(t.createdAt)}
                    <br />
                    到期：{expiryLabel(t.expiresAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TripExportButton tripId={t.id} />
                  <Link href={`/trips/${t.id}/video`} className="inline-flex min-h-11 items-center text-xs font-semibold text-warm underline">
                    下载视频
                  </Link>
                </div>
              </article>
            ))}
            {!trips.length && !loading && <p className="py-5 text-sm text-black/50">当前没有旅程。</p>}
          </div>
        </section>
      </PageContainer>
    </main>
  )
}
