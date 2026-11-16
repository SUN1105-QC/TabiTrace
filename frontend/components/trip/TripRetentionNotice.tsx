'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Download, Loader2, MessageSquare, TriangleAlert } from 'lucide-react'
import type { TripView, UserView } from '@/services/tabitrace-api'
import { exportTrip } from '@/services/admin'
import { utcDate } from '@/utils/video-status'

export function expiryLabel(value?: string) {
  return value
    ? (utcDate(value)?.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }) ?? value)
    : '读取中'
}

export function TripExportButton({ tripId }: { tripId: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await exportTrip(tripId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{' '}
        {busy ? '正在打包…' : '导出数据和原始照片'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}

export function TripRetentionNotice({ user, trips }: { user: UserView | null; trips: TripView[] }) {
  const pathname = usePathname()
  if (!user || user.role === 'ADMIN') return null
  const currentId = Number(pathname.match(/^\/trips\/(\d+)/)?.[1])
  const current = trips.find((t) => t.id === currentId)
  const now = Date.now()
  const due = trips
    .filter((t) => {
      const d = utcDate(t.expiresAt)
      return d && d.getTime() - now <= 7 * 86400000
    })
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''))
  const shown = current ? [current] : due.slice(0, 3)
  return (
    <section aria-label="账号配额与保留期限" className="tt-retention-notice page-container is-wide">
      <div
        className={`rounded-2xl border p-4 text-xs sm:text-sm ${due.length ? 'border-amber-300 bg-amber-50' : 'border-black/10 bg-white/80'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <b>{user.userLevel ?? '基础用户'}</b> · 已使用 {trips.length} / {user.tripLimit ?? 20} 条旅程 ·
            从创建起保留 {user.tripRetentionMonths ?? 1} 个月
          </p>
          <Link href="/support" className="inline-flex items-center gap-1 font-semibold text-warm underline">
            <MessageSquare size={14} /> 联系管理员 / 申请升级
          </Link>
        </div>
        <p className="mt-2 text-black/60">
          到期后旅程、照片及视频会自动删除。请提前导出备份；归档不会延长保留期限。
        </p>
        {due.length > 0 && (
          <p role="alert" className="mt-3 flex items-center gap-2 font-semibold text-amber-900">
            <TriangleAlert size={16} /> {due.length} 条旅程将在 7 天内到期，请及时保存。
          </p>
        )}
        {shown.map((t) => (
          <div
            key={t.id}
            className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3"
          >
            <p className="min-w-0 break-words">
              <Link href={`/trips/${t.id}/map`} className="font-semibold">
                {t.title}
              </Link>
              <span className="ml-2 text-black/60">到期：{expiryLabel(t.expiresAt)}</span>
            </p>
            <TripExportButton tripId={t.id} />
          </div>
        ))}
        {due.length > 3 && !current && (
          <Link href="/support" className="mt-3 inline-block underline">
            查看所有旅程及备份
          </Link>
        )}
      </div>
    </section>
  )
}
