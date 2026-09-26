'use client'

/** 轻量信息卡：穿插在地点列表中，让页面「呼吸」。点地点名定位到对应卡片，点「看全部」切换到对应筛选。 */

import { ArrowRight, CloudRain, Compass, Flame, LocateFixed, Sparkles, Sunset, Ticket } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import type { InfoCard } from '@/utils/explore'

const ICON = { NEAR: Compass, HOT: Flame, FREE: Ticket, RAIN: CloudRain, EVENING: Sunset, FIRST: Sparkles } as const

export function InfoCardView({ info, onPlace, onFilter, onLocate }: {
  info: InfoCard
  onPlace: (p: PlaceView) => void
  onFilter: (key: string) => void
  onLocate: () => void
}) {
  const Icon = ICON[info.key as keyof typeof ICON] ?? Sparkles
  return (
    <aside className={`ex-info is-${info.key.toLowerCase()}`}>
      <p className="ex-info-title"><Icon size={15} /> {info.title}</p>
      <p className="ex-info-hint">{info.hint}</p>
      {info.action === 'locate' ? (
        <button type="button" className="ex-add" onClick={onLocate}><LocateFixed size={14} /> 开启定位</button>
      ) : (
        <ol>
          {info.places.map(({ place, note }) => (
            <li key={place.id}>
              <button type="button" onClick={() => onPlace(place)}>{place.name}</button>
              {note && <span>{note}</span>}
            </li>
          ))}
        </ol>
      )}
      {info.filter && <button type="button" className="ex-link" onClick={() => onFilter(info.filter!)}>看全部 <ArrowRight size={12} /></button>}
    </aside>
  )
}
