/**
 * 格子 5：数据摘要，九宫格的视觉中心。浅米底、橙色大数字、四项核心数据。
 * 单日九宫格的前三项换成当天的数据（第几天 / 当天地点 / 当天照片），成就仍是整趟旅行的。
 */

import type { TripSummary, TripView } from '@/services/tabitrace-api'
import { cityOf } from '@/utils/share-long'
import { ShareGridTile } from './ShareGridTile'
import type { GridDay } from './ShareGridCard'

export function ShareGridDataTile({ trip, summary, day }: { trip: TripView; summary: TripSummary; day?: GridDay }) {
  const items: [string | number, string, string][] = day ? [
    [String(day.no).padStart(2, '0'), 'DAY', `第 ${day.no} 天`],
    [day.places, 'PLACES', '个地点'],
    [day.photos, 'PHOTOS', '张照片'],
    [summary.achievements, 'BADGES', '枚成就']
  ] : [
    [summary.days, 'DAYS', '天'],
    [summary.places, 'PLACES', '个地点'],
    [summary.photos, 'PHOTOS', '张照片'],
    [summary.achievements, 'BADGES', '枚成就']
  ]
  return (
    <ShareGridTile variant="data">
      <span className="sg-kicker">JOURNEY DATA</span>
      <dl className="sg-data">
        {items.map(([value, en, zh]) => (
          <div key={en}>
            <dt>{value}</dt>
            <dd><b>{en}</b>{zh}</dd>
          </div>
        ))}
      </dl>
      {summary.explorationRate > 0 && (
        <p className="sg-data-note">已探索 {cityOf(trip)} 精选地点的 {summary.explorationRate}%</p>
      )}
    </ShareGridTile>
  )
}
