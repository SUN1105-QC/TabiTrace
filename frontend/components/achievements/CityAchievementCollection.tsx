'use client'

/**
 * 城市成就收藏：按 cityCode 聚合（结构为 code / name / achievements[]），不写死东京。
 * 有多个城市时出现城市切换；目前数据里只有东京就只显示东京。徽章在手机上横向滚动。
 */

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { AchievementView } from '@/services/tabitrace-api'
import { STATUS_LABEL, getAchievementStatus, type CityCollection } from '@/utils/achievements'
import { AchievementBadge } from './AchievementBadge'

export function CityAchievementCollection({ cities, onOpen }: { cities: CityCollection[]; onOpen: (a: AchievementView) => void }) {
  const [code, setCode] = useState(cities[0]?.code)
  const city = cities.find(c => c.code === code) ?? cities[0]
  if (!city) return null
  return (
    <section className="ac-section" id="ac-city">
      <header className="ac-section-head">
        <div>
          <p className="ac-eyebrow">{city.en} COLLECTION</p>
          <h2>{city.name}专属成就 <small>{city.unlocked} / {city.achievements.length}</small></h2>
          <p>只在{city.name}的旅行里才能收集的徽章。</p>
        </div>
        {cities.length > 1 && (
          <div className="ac-seg" role="tablist" aria-label="城市">
            {cities.map(c => <button key={c.code} type="button" role="tab" aria-selected={c.code === city.code} className={c.code === city.code ? 'is-active' : ''} onClick={() => setCode(c.code)}>{c.name}</button>)}
          </div>
        )}
      </header>
      <div className="ac-city">
        <div className="ac-city-row">
          {city.achievements.map(a => {
            const status = getAchievementStatus(a)
            return (
              <button key={a.id} type="button" className={`ac-city-item is-${status}`} onClick={() => onOpen(a)} aria-label={`${a.name}，${STATUS_LABEL[status]}`}>
                <AchievementBadge achievement={a} size={84} />
                <b>{a.name}</b>
                <small>{STATUS_LABEL[status]}</small>
              </button>
            )
          })}
        </div>
        {city.explore && <Link href={city.explore} className="ac-action">在推荐探索里找{city.name}的地点 <ArrowRight size={13} /></Link>}
      </div>
    </section>
  )
}
