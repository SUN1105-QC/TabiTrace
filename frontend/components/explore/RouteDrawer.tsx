'use client'

/** 专题详情：按游览顺序列出地点，可以逐个加入，也可以一次把整条路线加入当前旅行。 */

import { useEffect } from 'react'
import { Check, Clock3, MapPin, Plus, X } from 'lucide-react'
import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'
import { stayLabel } from '@/utils/explore'
import { PlaceCover } from './PlaceCover'
import type { ExploreActions } from './PlaceActions'

export function RouteDrawer({ route, byId, actions, onAddAll, onClose }: {
  route: OfficialRouteView
  byId: Map<number, PlaceView>
  actions: ExploreActions
  onAddAll: (places: PlaceView[]) => void
  onClose: () => void
}) {
  const places = route.placeIds.map(id => byId.get(id)).filter((p): p is PlaceView => !!p)
  const remaining = places.filter(p => !actions.added.has(p.id))
  const totalStay = places.reduce((s, p) => s + (p.stayMinutes ?? 0), 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ex-drawer-backdrop" onClick={onClose}>
      <aside className="ex-drawer" role="dialog" aria-label={route.title} onClick={e => e.stopPropagation()}>
        <div className="ex-drawer-hero">
          {route.coverImage && <img src={route.coverImage} alt="" />}
          <button type="button" className="ex-drawer-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
          <div>
            <small>{route.englishTitle.toUpperCase()}</small>
            <h2>{route.title}</h2>
          </div>
        </div>
        <div className="ex-drawer-body">
          <p className="ex-drawer-desc">{route.description}</p>
          <p className="ex-drawer-meta"><MapPin size={13} /> {places.length} 个地点{route.durationHint ? ` · 建议${route.durationHint}` : ''}{totalStay ? ` · 各点停留合计约 ${stayLabel(totalStay)}` : ''}</p>
          <ol className="ex-stops">
            {places.map((p, i) => {
              const added = actions.added.has(p.id)
              return (
                <li key={p.id}>
                  <em>{String(i + 1).padStart(2, '0')}</em>
                  <PlaceCover place={p} className="is-thumb" />
                  <span className="ex-stop-text">
                    <b>{p.name}</b>
                    <small>{p.tagline}</small>
                    {p.stayMinutes ? <small className="ex-stop-meta"><Clock3 size={11} /> {stayLabel(p.stayMinutes)} · {p.bestTime}</small> : null}
                  </span>
                  <button type="button" className={`ex-icon-btn${added ? ' is-on' : ''}`} disabled={added || actions.busy.has(p.id)} onClick={() => actions.onAdd(p)} aria-label={added ? '已在旅行中' : `加入 ${p.name}`}>
                    {added ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <footer className="ex-drawer-foot">
          <button type="button" className="ex-btn is-primary" disabled={!remaining.length} onClick={() => onAddAll(remaining)}>
            {remaining.length ? <><Plus size={15} /> 整条路线加入当前旅行（{remaining.length}）</> : <><Check size={15} /> 路线里的地点都已在旅行中</>}
          </button>
        </footer>
      </aside>
    </div>
  )
}
