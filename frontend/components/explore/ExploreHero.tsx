'use client'

/**
 * 首屏：左侧标题、说明与两个操作，右侧一张东京氛围照片；下方是搜索、分类与一行真实统计。
 * 不再放统计卡和快捷标签墙——用户在这里只需要决定「搜一下」还是「往下看推荐」。
 */

import Link from 'next/link'
import { ArrowDown, Compass } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'
import { PlaceImage } from '@/components/common/PlaceImage'
import { hdImage } from '@/utils/place-images'
import { ExploreSearch } from './ExploreSearch'
import { ExploreCategoryFilter } from './ExploreCategoryFilter'

export function ExploreHero({ query, category, stats, resultCount, signedIn, target, allJoined, onQuery, onCategory, onStart, onShowResults, onChangeTrip }: {
  query: string
  category: string
  /** 只显示已经加载到的真实数字 */
  stats: { places?: number; areas?: number; routes?: number }
  resultCount: number
  signedIn: boolean
  target: TripView | null
  /** 目标旅行加入了官方探索：全部官方地点已经在旅行里 */
  allJoined: boolean
  onQuery: (q: string) => void
  onCategory: (key: string) => void
  onStart: () => void
  onShowResults: () => void
  onChangeTrip: () => void
}) {
  const statLine = [
    stats.places ? `${stats.places} 个精选地点` : '',
    stats.areas ? `${stats.areas} 个区域` : '',
    stats.routes ? `${stats.routes} 条旅行灵感` : ''
  ].filter(Boolean).join(' · ')

  return (
    <section className="xp-hero" aria-labelledby="xp-hero-title">
      <div className="xp-hero-text">
        <p className="xp-eyebrow">EXPLORE TOKYO</p>
        <h1 id="xp-hero-title">从东京开始，<br />探索一座城市的另一种方式。</h1>
        <p className="xp-hero-lead">发现值得去的地方，<br />把喜欢的地点加入下一段旅程。</p>
        <div className="xp-hero-cta">
          <button type="button" className="xp-btn is-primary" onClick={onStart}><Compass size={16} /> 开始探索</button>
          <Link href="/trips" className="xp-btn">查看我的旅行</Link>
        </div>
      </div>

      <figure className="xp-hero-media">
        <PlaceImage src={hdImage('07-tokyo-station')} alt="东京站丸之内站舍" sizes="(max-width: 1023px) 100vw, 560px" eager />
        <figcaption>TOKYO · 东京站丸之内站舍</figcaption>
      </figure>

      <div className="xp-hero-tools">
        <ExploreSearch value={query} onChange={onQuery} onSubmit={onShowResults} />
        <ExploreCategoryFilter value={category} onChange={onCategory} label="按分类浏览地点" />
        <div className="xp-hero-foot">
          {statLine && <p className="xp-hero-stats">{statLine}</p>}
          {query ? (
            <button type="button" className="xp-link" onClick={onShowResults}>找到 {resultCount} 个地点 · 查看结果 <ArrowDown size={13} /></button>
          ) : signedIn ? (
            <p className="xp-trip-line">
              {target ? (allJoined
                ? <>「<Link href={`/trips/${target.id}`}>{target.title}</Link>」已加入东京官方探索，全部地点都在这段旅行里</>
                : <>地点会加入：<Link href={`/trips/${target.id}`}>{target.title}</Link></>) : '加入地点时可以选择旅行'}
              <button type="button" className="xp-link" onClick={onChangeTrip}>{target ? '更换' : '选择旅行'}</button>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
