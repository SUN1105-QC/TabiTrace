'use client'

/** 专题详情（旅行灵感）：按游览顺序列出地点，可以逐个加入，也可以把整条路线加入旅行；点地点名打开地点详情。 */

import { useEffect } from 'react'
import { Check, Clock3, MapPin, Plus, X } from 'lucide-react'
import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'
import { stayLabel } from '@/utils/explore'
import { ImageCredit } from '@/components/common/ImageCredit'
import { PlaceImage } from '@/components/common/PlaceImage'
import { COVER_SIZES, PlaceCover } from './PlaceCover'

export function RouteDrawer({ route, byId, joined, busy, onAdd, onAddAll, onOpenPlace, onClose }: {
  route: OfficialRouteView
  byId: Map<number, PlaceView>
  joined: Set<number>
  busy: Set<number>
  onAdd: (p: PlaceView) => void
  onAddAll: (places: PlaceView[]) => void
  onOpenPlace: (p: PlaceView) => void
  onClose: () => void
}) {
  const places = route.placeIds.map(id => byId.get(id)).filter((p): p is PlaceView => !!p)
  const remaining = places.filter(p => !joined.has(p.id))
  const totalStay = places.reduce((s, p) => s + (p.stayMinutes ?? 0), 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ex-drawer-backdrop" onClick={onClose}>
      <aside className="ex-drawer" role="dialog" aria-modal="true" aria-label={route.title} onClick={e => e.stopPropagation()}>
        <div className="ex-drawer-hero">
          {route.coverImage && <PlaceImage src={route.coverImage} alt={route.title} sizes={COVER_SIZES.detail} eager />}
          <button type="button" className="ex-drawer-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
          <div>
            <small>{route.englishTitle.toUpperCase()}</small>
            <h2>{route.title}</h2>
          </div>
        </div>
        <div className="ex-drawer-body">
          <p className="ex-drawer-desc">{route.description}</p>
          <p className="ex-drawer-meta"><MapPin size={13} /> {places.length} 个地点{route.durationHint ? ` · 建议${route.durationHint}` : ''}{totalStay ? ` · 各点停留合计约 ${stayLabel(totalStay)}` : ''}</p>
          <ImageCredit url={route.coverImage} label="封面图片" />
          <ol className="ex-stops">
            {places.map((p, i) => {
              const added = joined.has(p.id)
              return (
                <li key={p.id}>
                  <em>{String(i + 1).padStart(2, '0')}</em>
                  <PlaceCover place={p} className="is-thumb" sizes={COVER_SIZES.thumb} />
                  <span className="ex-stop-text">
                    <button type="button" className="ex-stop-name" onClick={() => onOpenPlace(p)}>{p.name}</button>
                    <small>{p.tagline}</small>
                    {p.stayMinutes ? <small className="ex-stop-meta"><Clock3 size={11} /> {stayLabel(p.stayMinutes)} · {p.bestTime}</small> : null}
                  </span>
                  <button type="button" className={`ex-icon-btn${added ? ' is-on' : ''}`} disabled={added || busy.has(p.id)} onClick={() => onAdd(p)} aria-label={added ? `${p.name} 已加入旅行` : `把 ${p.name} 加入旅行`}>
                    {added ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <footer className="ex-drawer-foot">
          <button type="button" className="xp-btn is-primary" disabled={!remaining.length} onClick={() => onAddAll(remaining)}>
            {remaining.length ? <><Plus size={15} /> 整条路线加入旅行（{remaining.length}）</> : <><Check size={15} /> 路线里的地点都已加入</>}
          </button>
        </footer>
      </aside>
    </div>
  )
}
