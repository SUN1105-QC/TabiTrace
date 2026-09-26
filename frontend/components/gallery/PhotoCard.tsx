'use client'

/**
 * 照片卡片：默认只突出照片（精选照片左上角一个小星标）。
 * 悬停（触屏上常显）时显示地点、日期、精选开关与“更多”菜单；删除收在更多菜单里。
 * 选择模式下点整张卡片即勾选。
 */

import { useEffect, useRef } from 'react'
import { Check, Image as ImageIcon, MoreHorizontal, Star, Trash2, Maximize2 } from 'lucide-react'
import type { GalleryItem } from '@/utils/gallery'

export function PhotoCard({ item, index, selecting, selected, isCover, readOnly, menuOpen, onOpen, onToggleSelect, onToggleFeatured, onMenu, onCover, onDelete }: {
  item: GalleryItem
  index: number
  selecting: boolean
  selected: boolean
  isCover: boolean
  readOnly: boolean
  menuOpen: boolean
  onOpen: () => void
  onToggleSelect: () => void
  onToggleFeatured: () => void
  onMenu: (open: boolean) => void
  onCover: () => void
  onDelete: () => void
}) {
  const { photo, when, checkin } = item
  const menu = useRef<HTMLDivElement | null>(null)
  const place = checkin ? [checkin.placeName, checkin.area].filter(Boolean).join(' · ') : ''
  const label = `照片 ${index + 1}${place ? `，${place}` : ''}${when ? `，${when.date}` : ''}${photo.featured ? '，精选' : ''}`

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) onMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onMenu(false) }
    window.addEventListener('mousedown', close); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc) }
  }, [menuOpen, onMenu])

  return (
    <figure className={`gl-card${photo.featured ? ' is-featured' : ''}${selected ? ' is-selected' : ''}${selecting ? ' is-selecting' : ''}${menuOpen ? ' is-menu' : ''}`}>
      <button type="button" className="gl-card-hit" onClick={selecting ? onToggleSelect : onOpen} aria-label={selecting ? `${selected ? '取消选择' : '选择'}${label}` : `查看${label}`} aria-pressed={selecting ? selected : undefined}>
        <img src={photo.imageUrl} alt="" loading="lazy" decoding="async" />
      </button>

      {photo.featured && !selecting && <span className="gl-star-badge" aria-hidden="true"><Star size={11} /></span>}
      {isCover && !selecting && <span className="gl-cover-badge" aria-hidden="true">封面</span>}
      {selecting && <span className={`gl-check${selected ? ' is-on' : ''}`} aria-hidden="true">{selected && <Check size={14} />}</span>}

      {!selecting && (
        <figcaption className="gl-card-info">
          <span className="gl-card-text">
            {place && <b>{place}</b>}
            <small>{when ? `${when.date.slice(5).replace('-', '.')} ${when.time}` : '未分类'}</small>
          </span>
          {!readOnly && (
            <button type="button" className={`gl-card-star${photo.featured ? ' is-on' : ''}`} onClick={onToggleFeatured} aria-pressed={photo.featured} aria-label={photo.featured ? '取消精选' : '设为精选'}>
              <Star size={15} />
            </button>
          )}
          <div className="gl-menu-wrap" ref={menu}>
            <button type="button" className="gl-card-more" onClick={() => onMenu(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="更多操作">
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="gl-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { onMenu(false); onOpen() }}><Maximize2 size={14} /> 查看详情</button>
                {!readOnly && <button type="button" role="menuitem" onClick={() => { onMenu(false); onToggleFeatured() }}><Star size={14} /> {photo.featured ? '取消精选' : '设为精选'}</button>}
                {!readOnly && !isCover && <button type="button" role="menuitem" onClick={() => { onMenu(false); onCover() }}><ImageIcon size={14} /> 设为旅行封面</button>}
                {!readOnly && <button type="button" role="menuitem" className="is-danger" onClick={() => { onMenu(false); onDelete() }}><Trash2 size={14} /> 删除照片</button>}
              </div>
            )}
          </div>
        </figcaption>
      )}
    </figure>
  )
}

export function PhotoGridSkeleton({ count = 12 }: { count?: number }) {
  return <div className="gl-grid" aria-busy="true" aria-label="正在加载照片">{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton gl-sk" />)}</div>
}
