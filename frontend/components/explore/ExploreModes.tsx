'use client'

/** 探索方式快捷入口：按目标进入，而不是只能从上往下刷卡片。数量来自真实标签统计。 */

import { Camera, Landmark, MoonStar, Footprints } from 'lucide-react'
import type { PlaceView } from '@/services/tabitrace-api'

const MODES = [
  { key: 'MUST', title: '必去地标', desc: '第一次来东京的经典目的地', icon: Landmark },
  { key: 'WALK', title: '城市漫步', desc: '适合散步、感受街头气息的街区', icon: Footprints },
  { key: 'PHOTO', title: '拍照出片', desc: '更适合拍照打卡的风景和街道', icon: Camera },
  { key: 'NIGHT', title: '夜晚东京', desc: '夜景、城市灯光与深夜氛围', icon: MoonStar }
]

export function ExploreModes({ places, active, onPick }: { places: PlaceView[]; active: string; onPick: (key: string) => void }) {
  return (
    <section className="ex-modes" id="ex-modes">
      {MODES.map(m => {
        const count = places.filter(p => p.tags?.includes(m.key)).length
        const Icon = m.icon
        return (
          <button key={m.key} type="button" className={`ex-mode${active === m.key ? ' is-active' : ''}`} onClick={() => onPick(m.key)}>
            <span className="ex-mode-icon"><Icon size={18} /></span>
            <span className="ex-mode-text">
              <b>{m.title}</b>
              <small>{m.desc}</small>
            </span>
            <em>{count}</em>
          </button>
        )
      })}
    </section>
  )
}
