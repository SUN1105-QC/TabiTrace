'use client'

/** 底部行动出口：自由旅行、东京成就、地图查看全部地点。一张浅暖色、一张深色、一张白色，形成收尾节奏。 */

import Link from 'next/link'
import { ArrowRight, Map as MapIcon, Sparkles, Trophy } from 'lucide-react'

export function ExploreGuide({ tripId, onMap }: { tripId: number; onMap: () => void }) {
  return (
    <section className="ex-guide">
      <div className="ex-guide-card is-warm">
        <Sparkles size={20} />
        <h3>官方探索 + 自由旅行</h3>
        <p>官方精选给你一个轻松的起点，你自己发现的咖啡店、街角与临时起意，同样会进入地图、时间轴和旅行作品。</p>
        <Link href={tripId ? `/trips/${tripId}/map` : '/trips/new'} className="ex-link">{tripId ? '去地图打卡' : '创建一段旅行'} <ArrowRight size={13} /></Link>
      </div>
      <div className="ex-guide-card is-dark">
        <Trophy size={20} />
        <h3>东京专属成就</h3>
        <p>东京初心者、东京传统派、东京夜行者、东京达人——完成对应地点的打卡后自动解锁。</p>
        <Link href={tripId ? `/trips/${tripId}/achievements` : '/trips'} className="ex-link">查看成就进度 <ArrowRight size={13} /></Link>
      </div>
      <div className="ex-guide-card">
        <MapIcon size={20} />
        <h3>用地图查看全部地点</h3>
        <p>在地图上看看这些地点分布在哪里，顺路的放在同一天会轻松很多。</p>
        <button type="button" className="ex-link" onClick={onMap}>打开地图视图 <ArrowRight size={13} /></button>
      </div>
    </section>
  )
}
