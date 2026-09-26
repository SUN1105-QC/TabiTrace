'use client'

/**
 * 添加照片：拖拽或选择多张照片 → 可选关联打卡 / 设为精选 → 逐张上传（同时 2 张）。
 * 每张独立显示 等待 / 上传中 / 完成 / 失败，单张失败不影响其他照片，失败的可以重试。
 * 上传仍走现有 uploadTripPhoto（预签名上传 + 登记）；JPEG 会读取 EXIF 拍摄时间写入 capturedAt。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, ImagePlus, Loader2, RotateCcw, Upload, X } from 'lucide-react'
import { uploadTripPhoto, type CheckinView } from '@/services/tabitrace-api'
import { offsetIso } from '@/lib/time'
import { FREE_PHOTO_LIMIT, MAX_PHOTO_BYTES, readExifDate } from '@/utils/gallery'

type Status = 'waiting' | 'uploading' | 'done' | 'failed'
type QueueItem = { id: number; file: File; url: string; status: Status; error?: string }

const STATUS_TEXT: Record<Status, string> = { waiting: '等待上传', uploading: '上传中…', done: '已完成', failed: '上传失败' }
const CONCURRENCY = 2
let seq = 0

export function UploadDialog({ tripId, checkins, freeUsed, onClose, onUploaded }: {
  tripId: number
  checkins: CheckinView[]
  /** 免费旅行已有照片数；Pro 旅行传 null（没有张数上限） */
  freeUsed: number | null
  onClose: () => void
  onUploaded: (count: number) => void
}) {
  const titleId = useId()
  const input = useRef<HTMLInputElement | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [checkinId, setCheckinId] = useState('')
  const [featured, setFeatured] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const uploaded = useRef(0)
  const urls = useRef<string[]>([])

  useEffect(() => () => urls.current.forEach(u => URL.revokeObjectURL(u)), [])

  const close = () => {
    if (running) return
    if (uploaded.current) onUploaded(uploaded.current)
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const add = (files: FileList | File[]) => {
    const next: QueueItem[] = []
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      const error = !file.type.startsWith('image/') ? '不是图片文件' : file.size > MAX_PHOTO_BYTES ? '超过 20MB' : undefined
      next.push({ id: ++seq, file, url, status: error ? 'failed' : 'waiting', error })
    }
    setQueue(q => [...q, ...next])
  }

  const patch = (id: number, p: Partial<QueueItem>) => setQueue(q => q.map(i => (i.id === id ? { ...i, ...p } : i)))

  const uploadOne = async (item: QueueItem) => {
    patch(item.id, { status: 'uploading', error: undefined })
    try {
      const exif = await readExifDate(item.file)
      await uploadTripPhoto(tripId, item.file, {
        checkinId: checkinId ? Number(checkinId) : undefined,
        featured,
        capturedAt: exif ? offsetIso(exif.date, exif.time) : undefined
      })
      uploaded.current++
      patch(item.id, { status: 'done' })
    } catch (e) {
      patch(item.id, { status: 'failed', error: e instanceof Error && e.message ? e.message : '上传失败' })
    }
  }

  const start = async (items: QueueItem[]) => {
    if (!items.length) return
    setRunning(true)
    const todo = [...items]
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      for (let it = todo.shift(); it; it = todo.shift()) await uploadOne(it)
    }))
    setRunning(false)
  }

  const waiting = queue.filter(i => i.status === 'waiting')
  const failedRetryable = queue.filter(i => i.status === 'failed' && i.file.type.startsWith('image/') && i.file.size <= MAX_PHOTO_BYTES)
  const done = queue.filter(i => i.status === 'done').length
  const remaining = freeUsed === null ? null : Math.max(0, FREE_PHOTO_LIMIT - freeUsed - done)

  return (
    <div className="modal-backdrop gl-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="modal-panel gl-upload" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div>
            <p className="gl-eyebrow">ADD PHOTOS</p>
            <h2 id={titleId}>添加照片</h2>
          </div>
          <button type="button" className="icon-button" onClick={close} disabled={running} aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="gl-upload-body">
          <div
            className={`gl-drop${dragging ? ' is-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files) }}
          >
            <ImagePlus size={26} aria-hidden="true" />
            <b>把照片拖到这里</b>
            <small>支持多张，单张不超过 20MB{remaining !== null ? ` · 免费旅行还可以再放 ${remaining} 张` : ''}</small>
            <button type="button" className="gl-btn" onClick={() => input.current?.click()} disabled={running}>选择照片</button>
            <input ref={input} type="file" accept="image/*" multiple hidden tabIndex={-1} aria-hidden="true" onChange={e => { if (e.target.files?.length) add(e.target.files); e.target.value = '' }} />
          </div>

          <div className="gl-upload-options">
            <label htmlFor="gl-up-checkin">关联打卡</label>
            <select id="gl-up-checkin" className="gl-input" value={checkinId} onChange={e => setCheckinId(e.target.value)} disabled={running}>
              <option value="">不关联打卡</option>
              {checkins.map(c => <option key={c.id} value={c.id}>{c.placeName} · {c.checkinTime.slice(5, 16).replace('T', ' ')}</option>)}
            </select>
            <label className="gl-check-row">
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} disabled={running} />
              同时设为精选（优先用于分享成果与 Travel Story）
            </label>
          </div>

          {queue.length > 0 && (
            <>
              <p className="gl-upload-summary" aria-live="polite">{done} / {queue.length} 已完成{queue.some(i => i.status === 'failed') ? ` · ${queue.filter(i => i.status === 'failed').length} 张失败` : ''}</p>
              <ul className="gl-queue">
                {queue.map(i => (
                  <li key={i.id} className={`is-${i.status}`}>
                    <img src={i.url} alt="" />
                    <span className="gl-queue-text">
                      <b title={i.file.name}>{i.file.name}</b>
                      <small>{i.status === 'failed' && i.error ? `${STATUS_TEXT.failed}：${i.error}` : STATUS_TEXT[i.status]}</small>
                    </span>
                    {i.status === 'uploading' && <Loader2 size={16} className="gl-spin" aria-hidden="true" />}
                    {i.status === 'done' && <CheckCircle2 size={16} className="gl-ok" aria-hidden="true" />}
                    {i.status === 'failed' && <CircleAlert size={16} className="gl-bad" aria-hidden="true" />}
                    {(i.status === 'waiting' || (i.status === 'failed' && !running)) && (
                      <button type="button" className="gl-icon" onClick={() => setQueue(q => q.filter(x => x.id !== i.id))} aria-label={`移除 ${i.file.name}`}><X size={14} /></button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="gl-upload-actions">
          {failedRetryable.length > 0 && !running && (
            <button type="button" className="gl-btn" onClick={() => void start(failedRetryable)}><RotateCcw size={14} /> 重试失败的 {failedRetryable.length} 张</button>
          )}
          <button type="button" className="gl-btn is-primary" onClick={() => void start(waiting)} disabled={running || waiting.length === 0}>
            {running ? <><Loader2 size={15} className="gl-spin" /> 正在上传…</> : <><Upload size={15} /> 上传 {waiting.length || ''} 张照片</>}
          </button>
          {!running && done > 0 && waiting.length === 0 && <button type="button" className="gl-btn" onClick={close}>完成</button>}
        </div>
      </div>
    </div>
  )
}
