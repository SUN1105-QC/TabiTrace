'use client'

/**
 * Hero 右上角“···”：编辑 / 归档（取消归档）/ 删除。
 * 移动端以底部 Action Sheet 打开；删除走通用确认对话框。只提供后端真实支持的操作。
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { tripApi, type TripView } from '@/services/tabitrace-api'
import { isArchived } from '@/utils/trip'
import { EditTripSheet } from './EditTripSheet'

export function TripMoreMenu({ trip, onChanged, onToast }: { trip: TripView; onChanged: (t: TripView) => void; onToast: (msg: string) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const sheet = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const archived = isArchived(trip)

  useEffect(() => {
    if (!open) return
    sheet.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() { setOpen(false); trigger.current?.focus() }

  const toggleArchive = async () => {
    setBusy(true)
    try {
      const next = archived ? await tripApi.unarchive(trip.id) : await tripApi.archive(trip.id)
      onChanged(next)
      onToast(archived ? '已取消归档' : '旅行已归档')
      setOpen(false)
    } catch (e) {
      onToast(e instanceof Error && e.message ? e.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await tripApi.delete(trip.id)
      if (localStorage.getItem('tabitrace-live-trip-id') === String(trip.id)) localStorage.removeItem('tabitrace-live-trip-id')
      router.replace('/trips')
    } catch (e) {
      onToast(e instanceof Error && e.message ? e.message : '删除失败，请重试')
      setBusy(false)
      setMode(null)
    }
  }

  return (
    <>
      <button ref={trigger} type="button" className="td-more" aria-label="旅行操作" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <MoreHorizontal size={20} />
      </button>

      {open && (
        <div className="td-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
          <div className="td-sheet" role="dialog" aria-modal="true" aria-label="旅行操作" ref={sheet}>
            <span className="td-sheet-handle" aria-hidden="true" />
            <p className="td-sheet-title">{trip.title}</p>
            <div className="td-sheet-list">
              <button type="button" onClick={() => { setOpen(false); setMode('edit') }} disabled={archived || busy}>
                <Pencil size={17} /> <span>编辑旅行{archived && <small>取消归档后才能编辑</small>}</span>
              </button>
              <button type="button" onClick={() => void toggleArchive()} disabled={busy}>
                {archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                <span>{archived ? '取消归档' : '归档旅行'}<small>{archived ? '恢复后可以继续打卡和编辑' : '归档后只能回看，不能再打卡或修改'}</small></span>
              </button>
              <button type="button" className="is-danger" onClick={() => { setOpen(false); setMode('delete') }} disabled={busy}>
                <Trash2 size={17} /> <span>删除旅行</span>
              </button>
            </div>
            <button type="button" className="td-sheet-cancel" onClick={close}>取消</button>
          </div>
        </div>
      )}

      {mode === 'edit' && <EditTripSheet trip={trip} onClose={() => setMode(null)} onSaved={t => { setMode(null); onChanged(t); onToast('旅行信息已更新') }} />}

      {mode === 'delete' && (
        <ConfirmDialog
          title="删除这段旅行？"
          body={<p>「{trip.title}」的打卡、照片、成就、分享链接和 Travel Story 会一起删除，且无法恢复。</p>}
          onCancel={() => { if (!busy) setMode(null) }}
          actions={<>
            <button type="button" className="st-btn" onClick={() => setMode(null)} disabled={busy}>取消</button>
            <button type="button" className="st-btn is-danger-fill" onClick={() => void remove()} disabled={busy}>{busy ? '正在删除…' : '删除旅行'}</button>
          </>}
        />
      )}
    </>
  )
}
