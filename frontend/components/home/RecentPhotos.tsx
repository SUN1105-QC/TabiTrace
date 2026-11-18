'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Plus, X } from 'lucide-react'
import type { PhotoView } from '@/services/tabitrace-api'
import { photoMedium, photoThumb } from '@/utils/photo-variants'
import { toDate } from '@/lib/time'

function PhotoImage({ photo, large = false }: { photo: PhotoView; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span className="hw-photo-fallback"><ImageIcon size={24} /><span>照片暂时无法显示</span></span>
    : <img src={large ? photoMedium(photo) : photoThumb(photo)} alt="旅行照片" loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
}

/** 首页只预览最近六张；编辑和上传继续交给现有相册页面。 */
export function RecentPhotos({ photos, tripId, readOnly }: { photos: PhotoView[]; tripId: number; readOnly: boolean }) {
  const recent = [...photos].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0) || b.id - a.id).slice(0, 6)
  const [selected, setSelected] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (selected === null) return
    dialog.current?.showModal()
    closeButton.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [selected])
  function close() { dialog.current?.close(); setSelected(null); opener.current?.focus() }
  function step(delta: number) { setSelected(i => i === null ? null : (i + delta + recent.length) % recent.length) }
  return <section className="hw-section hw-photos">
    <header><h2>最近照片</h2><Link href={`/trips/${tripId}/gallery`}>全部照片<ChevronRight size={14} /></Link></header>
    {recent.length ? <>
      <div className="hw-photo-grid">{recent.map((photo, index) => <button key={photo.id} type="button" aria-label={`查看第 ${index + 1} 张旅行照片`} onClick={e => { opener.current = e.currentTarget; setSelected(index) }}><PhotoImage key={photo.id} photo={photo} /></button>)}</div>
      {!readOnly && <Link className="hw-secondary" href={`/trips/${tripId}/gallery`}><Plus size={15} />整理与添加照片</Link>}
    </> : <div className="hw-photo-empty"><span className="hw-round"><ImageIcon size={22} /></span><b>旅途故事，等待第一张照片</b><p>上传照片，留住值得回忆的瞬间。</p>{!readOnly && <Link className="hw-secondary" href={`/trips/${tripId}/gallery`}><Plus size={17} />添加照片</Link>}</div>}
    {selected !== null && recent[selected] && <dialog ref={dialog} className="hw-photo-dialog" aria-label="旅行照片预览" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }} onKeyDown={e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    }}>
      <header><b>旅行照片 · {selected + 1} / {recent.length}</b>{document.fullscreenEnabled && <button type="button" aria-label="全屏查看" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void dialog.current?.requestFullscreen().catch(() => {}) }}><Maximize2 size={20} /></button>}<button ref={closeButton} type="button" aria-label="关闭照片预览" onClick={close}><X size={20} /></button></header>
      <div className="hw-photo-view"><PhotoImage key={recent[selected].id} photo={recent[selected]} large /></div>
      <footer><button type="button" aria-label="上一张照片" disabled={recent.length < 2} onClick={() => step(-1)}><ChevronLeft size={22} /></button><Link href={`/trips/${tripId}/gallery`}>前往相册整理</Link><button type="button" aria-label="下一张照片" disabled={recent.length < 2} onClick={() => step(1)}><ChevronRight size={22} /></button></footer>
    </dialog>}
  </section>
}
