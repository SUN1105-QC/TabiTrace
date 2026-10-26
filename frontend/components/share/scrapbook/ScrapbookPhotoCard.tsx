'use client'

/**
 * 旅行手帐的一张照片卡：暖白相纸 + 照片 + 角标编号 + 底部地点标签，位置与旋转来自固定的 slot 预设。
 * 照片统一用中图（与标准九宫格一致）：整张 2 倍导出与「分别导出照片卡」（宽 1080）都够清晰，预览不加载原图。
 * 照片加载失败时换成安全的占位，不影响整张导出。
 */

import { useState } from 'react'
import { ImageOff, MapPin } from 'lucide-react'
import type { PhotoView } from '@/services/tabitrace-api'
import { photoMedium } from '@/utils/photo-variants'
import { SB_PAD, slotHeight, type ScrapLabel, type ScrapSlot } from '@/utils/share-scrapbook'

export function ScrapbookLocationLabel({ label, hero }: { label: ScrapLabel; hero?: boolean }) {
  if (!label.place && !label.area && !label.when) return null
  return (
    <figcaption className={`sb-label${hero ? ' is-hero' : ''}`}>
      {label.place && <b><MapPin aria-hidden="true" />{label.place}</b>}
      {(label.area || label.when) && (
        <span>
          {label.area && <small>{label.area}</small>}
          {label.when && <time>{label.when}</time>}
        </span>
      )}
    </figcaption>
  )
}

export function ScrapbookPhotoCard({ slot, photo, no, label, active, onSelect }: {
  slot: ScrapSlot
  photo: PhotoView
  no: number
  label: ScrapLabel
  active?: boolean
  onSelect?: () => void
}) {
  const [failed, setFailed] = useState(false)
  const cls = `sb-card${slot.hero ? ' is-hero' : ''}${onSelect ? ' is-editable' : ''}${active ? ' is-active' : ''}`
  const style = { left: slot.x, top: slot.y, width: slot.w, height: slotHeight(slot), zIndex: slot.z, transform: `rotate(${slot.rot}deg)`, padding: `${SB_PAD}px ${SB_PAD}px 0` }
  const body = (
    <>
      <div className="sb-photo" style={{ height: slot.ph }}>
        {failed
          ? <span className="sb-photo-fallback"><ImageOff aria-hidden="true" />照片暂时无法加载</span>
          : <img src={photoMedium(photo)} crossOrigin="anonymous" alt={label.place ?? '旅行照片'} decoding="async" onError={() => setFailed(true)} />}
        <span className="sb-no">{String(no).padStart(2, '0')}</span>
      </div>
      <ScrapbookLocationLabel label={label} hero={slot.hero} />
    </>
  )
  if (!onSelect) return <figure className={cls} style={style} data-no={no}>{body}</figure>
  return (
    <figure className={cls} style={style} data-no={no} role="button" tabIndex={0} aria-pressed={active}
      aria-label={`第 ${no} 张${slot.hero ? '（主图）' : ''}：${label.place ?? '旅行照片'}`}
      onClick={onSelect} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}>
      {body}
    </figure>
  )
}
