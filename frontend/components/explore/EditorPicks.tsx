'use client'

/**
 * 编辑精选：按官方内容库的 editor_rank 取前 3 个，大小不一——
 * 第一张占左侧两行的大卡，另外两张在右侧上下排列。每张带推荐理由。
 */

import { Award, Clock3, MapPin, Sun } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'
import { stayLabel } from '@/utils/explore'
import { PlaceCover } from './PlaceCover'
import { AddButton, FavoriteButton, type ExploreActions } from './PlaceActions'

export function EditorPicks({ places, actions }: { places: PlaceView[]; actions: ExploreActions }) {
  const picks = places.filter(p => p.editorRank != null).sort((a, b) => a.editorRank! - b.editorRank!).slice(0, 3)
  if (!picks.length) return null
  return (
    <section className="ex-section" id="ex-picks">
      <header className="ex-section-head">
        <div>
          <p className="ex-eyebrow">EDITOR&apos;S PICKS</p>
          <h2>编辑精选</h2>
          <p>第一次来东京，也值得先从这些地方开始。</p>
        </div>
      </header>
      <div className="ex-picks">
        {picks.map((p, i) => (
          <article key={p.id} className={`ex-card ex-pick${i === 0 ? ' is-lead' : ''}`}>
            <div className="ex-pick-media">
              <PlaceCover place={p} />
              <span className="ex-pick-badge"><Award size={12} /> 编辑推荐 · {String(i + 1).padStart(2, '0')}</span>
              <FavoriteButton place={p} actions={actions} light />
            </div>
            <div className="ex-pick-body">
              <div className="ex-pick-title">
                <span className="ex-chip">{p.category}</span>
                <h3>{p.name}</h3>
              </div>
              <p className="ex-pick-tagline">{p.tagline ?? p.description}</p>
              {p.recommendReason && <p className="ex-reason"><b>推荐理由</b>{p.recommendReason}</p>}
              <div className="ex-pick-foot">
                <ul className="ex-meta">
                  <li><MapPin size={12} />{p.area}</li>
                  {p.stayMinutes ? <li><Clock3 size={12} />{stayLabel(p.stayMinutes)}</li> : null}
                  {i === 0 && p.bestTime && <li><Sun size={12} />{p.bestTime}</li>}
                </ul>
                <AddButton place={p} actions={actions} primary />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
