'use client'

/** 首屏：左侧标题与入口，右侧是最近完成的一段旅行（FeaturedMemoryCard）；还没有完成的旅行时显示引导，不放空卡。 */

import Link from 'next/link'
import { ArrowRight, Clock3, Compass, Plus } from 'lucide-react'
import type { MemoryTrip } from '@/services/memories'
import { FeaturedMemoryCard } from './MemoryTripCard'

export function MemoriesHero({ featured, chips, onJump }: {
  featured: MemoryTrip | null
  chips: { label: string; target: string }[]
  onJump: (id: string) => void
}) {
  return (
    <section className={`mm-hero${featured ? '' : ' is-empty'}`}>
      <div className="mm-hero-text">
        <p className="mm-eyebrow">TRAVEL MEMORIES</p>
        <h1>旅行回忆</h1>
        {featured ? (
          <>
            <p className="mm-hero-lead">那些走过的路，都会成为更好的自己。<br />在这里回看已经归档的旅行、分享成果和 Travel Story。</p>
            <div className="mm-hero-cta">
              <button type="button" className="mm-btn is-primary" onClick={() => onJump('mm-archived')}><Compass size={15} /> 回看旅程</button>
              <button type="button" className="mm-btn" onClick={() => onJump('mm-timeline')}><Clock3 size={15} /> 浏览时间轴</button>
            </div>
            {chips.length > 0 && (
              <div className="mm-chips">
                {chips.map(c => <button key={c.label} type="button" onClick={() => onJump(c.target)}>{c.label}</button>)}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mm-hero-lead">你的旅行回忆将从第一段完成的旅程开始。</p>
            <div className="mm-hero-cta">
              <Link href="/trips/new" className="mm-btn is-primary"><Plus size={15} /> 创建旅行</Link>
              <Link href="/trips" className="mm-btn">回到我的旅行 <ArrowRight size={14} /></Link>
            </div>
          </>
        )}
      </div>
      {featured ? <FeaturedMemoryCard trip={featured} /> : (
        <div className="mm-card mm-hero-guide">
          <span className="mm-hero-guide-mark">旅</span>
          <p>完成一次旅行后，这里会为你保存旅途回忆。</p>
          <small>在旅行页点击「完成旅行」，它就会连同照片、成就、分享成果与 Travel Story 一起归档到这里。</small>
        </div>
      )}
    </section>
  )
}
