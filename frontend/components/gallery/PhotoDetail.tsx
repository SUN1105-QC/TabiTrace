'use client'

/**
 * 照片详情：大图 + 时间（注明来源）、地点与关联打卡、打卡文字、精选状态。
 * 操作都是已有能力：精选 / 取消精选、设为旅行封面、去分享成果、去 Travel Story、下载、删除；
 * 关联打卡可以修改（PUT /photos/{id}，同时保留原拍摄时间）。← → 切换上一张 / 下一张。
 */

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Film, Image as ImageIcon, Loader2, Share2, Star, Trash2, X } from 'lucide-react'
import type { CheckinView } from '@/services/tabitrace-api'
import { TIME_SOURCE_LABEL, type GalleryItem } from '@/utils/gallery'

export function PhotoDetail({ tripId, item, position, total, checkins, isCover, readOnly, onClose, onPrev, onNext, onToggleFeatured, onCover, onDelete, onLink }: {
  tripId: number
  item: GalleryItem
  position: number
  total: number
  checkins: CheckinView[]
  isCover: boolean
  readOnly: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onToggleFeatured: () => Promise<void>
  onCover: () => Promise<void>
  onDelete: () => void
  onLink: (checkinId: number | null) => Promise<void>
}) {
  const titleId = useId()
  const { photo, when, checkin } = item
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => { setLoaded(false); setDownloadError('') }, [photo.id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn() } finally { setBusy(null) } }

  // 下载：先按文件取回再保存；跨域下载被拦截时退回到新窗口打开原图
  const download = async () => {
    setDownloadError('')
    try {
      const res = await fetch(photo.imageUrl)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tabitrace-${tripId}-${photo.id}.${(photo.mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`
      document.body.appendChild(a); a.click(); a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      const w = window.open(photo.imageUrl, '_blank', 'noopener')
      if (!w) setDownloadError('下载失败，请稍后再试')
    }
  }

  return (
    <div className="modal-backdrop gl-detail-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel gl-detail" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="gl-detail-media">
          {!loaded && <div className="gl-detail-loading"><Loader2 size={22} className="gl-spin" /> 正在加载原图…</div>}
          <img src={photo.imageUrl} alt={checkin ? `${checkin.placeName} 的照片` : '旅行照片'} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} className={loaded ? '' : 'is-hidden'} />
          {total > 1 && <>
            <button type="button" className="gl-nav is-prev" onClick={onPrev} aria-label="上一张"><ChevronLeft size={20} /></button>
            <button type="button" className="gl-nav is-next" onClick={onNext} aria-label="下一张"><ChevronRight size={20} /></button>
          </>}
        </div>

        <aside className="gl-detail-side">
          <div className="gl-detail-head">
            <div>
              <p className="gl-eyebrow">PHOTO {position} / {total}</p>
              <h2 id={titleId}>{checkin?.placeName ?? '旅行照片'}</h2>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={16} /></button>
          </div>

          <dl className="gl-detail-facts">
            <div><dt>{when ? TIME_SOURCE_LABEL[when.source] : '时间'}</dt><dd>{when ? `${when.date.replace(/-/g, '.')} ${when.time}` : '未分类（没有拍摄或打卡时间）'}</dd></div>
            <div><dt>地点</dt><dd>{checkin ? [checkin.placeName, checkin.area].filter(Boolean).join(' · ') : '—'}</dd></div>
            <div>
              <dt><label htmlFor="gl-detail-checkin">关联打卡</label></dt>
              <dd>
                <select id="gl-detail-checkin" className="gl-input" value={photo.checkinId ?? ''} disabled={readOnly || busy !== null}
                  onChange={e => void run('link', () => onLink(e.target.value ? Number(e.target.value) : null))}>
                  <option value="">不关联打卡</option>
                  {checkins.map(c => <option key={c.id} value={c.id}>{c.placeName} · {c.checkinTime.slice(5, 16).replace('T', ' ')}</option>)}
                </select>
              </dd>
            </div>
            {checkin?.note && <div><dt>旅行文字</dt><dd className="gl-detail-note">{checkin.note}</dd></div>}
            <div><dt>精选</dt><dd>{photo.featured ? '已精选 · 优先用于分享成果与 Travel Story' : '未精选'}{isCover ? ' · 当前旅行封面' : ''}</dd></div>
          </dl>

          <div className="gl-detail-actions">
            {!readOnly && (
              <button type="button" className={`gl-btn${photo.featured ? '' : ' is-primary'}`} onClick={() => void run('feature', onToggleFeatured)} disabled={busy !== null} aria-pressed={photo.featured}>
                <Star size={14} /> {photo.featured ? '取消精选' : '设为精选'}
              </button>
            )}
            {!readOnly && (
              <button type="button" className="gl-btn" onClick={() => void run('cover', onCover)} disabled={busy !== null || isCover}>
                <ImageIcon size={14} /> {isCover ? '已是旅行封面' : '设为旅行封面'}
              </button>
            )}
            <Link href={`/trips/${tripId}/share`} className="gl-btn"><Share2 size={14} /> 用于分享成果</Link>
            <Link href={`/trips/${tripId}/video`} className="gl-btn"><Film size={14} /> 用于 Travel Story</Link>
            <button type="button" className="gl-btn" onClick={() => void download()}><Download size={14} /> 下载</button>
            {!readOnly && <button type="button" className="gl-btn is-danger" onClick={onDelete}><Trash2 size={14} /> 删除</button>}
          </div>
          {downloadError && <p className="gl-error" role="alert">⚠ {downloadError}</p>}
          <p className="gl-detail-hint">分享成果与 Travel Story 会优先使用精选照片；在那两个页面里还可以再挑选具体用哪几张。</p>
        </aside>
      </div>
    </div>
  )
}
