'use client'

/** 区域卡：区域名、一句定位、最多 3 个标签、地点数与入口。不用照片，四种柔和底色轻微区分。 */

import { ArrowRight } from 'lucide-react'
import type { AreaView } from '@/utils/explore'

export function AreaCard({ area, active, onPick }: { area: AreaView; active: boolean; onPick: (name: string) => void }) {
  return (
    <button type="button" className={`xp-area tone-${area.tone}${active ? ' is-active' : ''}`} onClick={() => onPick(area.name)} aria-pressed={active}>
      <b>{area.name}</b>
      <span className="xp-area-note">{area.note}</span>
      {area.tags.length > 0 && <span className="xp-area-tags">{area.tags.join(' · ')}</span>}
      <span className="xp-area-foot">
        <small>{area.count} 个地点</small>
        <em>探索{area.name} <ArrowRight size={12} /></em>
      </span>
    </button>
  )
}
