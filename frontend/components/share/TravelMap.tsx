/**
 * 极简线稿路线图：浅浅的道路纹理 + 墨绿细线连接真实打卡坐标 + 小圆点节点。
 * 不是地图 UI，也没有 Marker；没有坐标时只保留纹理和城市名，不画假路线。
 */

import type { TimelineDay, TripView } from '@/services/tabitrace-api'
import { cityKanji, roadTexture, routePoints, type MapPoint } from '@/utils/share-poster'

// 文字样式直接写成 SVG 属性：导出 PNG 时 html-to-image 不会带上 SVG 文字的 CSS 类样式
const SANS = 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif'

type Label = MapPoint & { anchor: 'start' | 'end'; dx: number; dy: number }

/** 标签默认放在点右侧；靠近右边缘放左侧；与已放好的标签太近时改放到点下方 */
function placeLabels(points: MapPoint[], width: number): Label[] {
  const placed: Label[] = []
  points.forEach(p => {
    const anchor = p.x > width - 96 ? 'end' : 'start'
    let dy = 4
    const crowded = placed.some(q => Math.abs(q.y + q.dy - (p.y + dy)) < 14 && Math.abs(q.x - p.x) < 110)
    if (crowded) dy = 18
    placed.push({ ...p, anchor, dx: anchor === 'start' ? 9 : -9, dy })
  })
  return placed
}

export function TravelMap({ trip, timeline, width, height }: { trip: TripView; timeline: TimelineDay[]; width: number; height: number }) {
  const points = routePoints(timeline, width, height)
  const labels = placeLabels(points, width)
  const roads = roadTexture(trip.id, width, height)
  const route = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg className="tp-map" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="旅行路线">
      <rect width={width} height={height} fill="#F1ECE1" />
      <g fill="none" stroke="#CBC4B6" strokeWidth="0.6" opacity="0.7">
        {roads.map((d, i) => <path key={i} d={d} strokeWidth={i === 3 ? 5 : 0.6} opacity={i === 3 ? 0.25 : 1} />)}
      </g>
      {points.length === 0 ? (
        <text x={width / 2} y={height / 2 + 12} textAnchor="middle" fontFamily={SERIF} fontSize="44" letterSpacing="8" fill="rgba(39,54,47,.3)">{cityKanji(trip)}</text>
      ) : (
        <>
          {points.length > 1 && <path d={route} fill="none" stroke="#27362F" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />}
          {labels.map((p, i) => (
            <g key={p.name}>
              <circle cx={p.x} cy={p.y} r={i === 0 ? 4.5 : 3.2} fill={i === 0 ? '#F6F2E8' : '#27362F'} stroke="#27362F" strokeWidth="1.2" />
              <text x={p.x + p.dx} y={p.y + p.dy} textAnchor={p.anchor} fontFamily={SANS} fontSize="10" fill="#27362F" stroke="#F1ECE1" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
                <tspan fontSize="8" fill="#B66C3C" letterSpacing="0.5">{String(i + 1).padStart(2, '0')} </tspan>{p.name}
              </text>
            </g>
          ))}
        </>
      )}
      <rect x="0.25" y="0.25" width={width - 0.5} height={height - 0.5} fill="none" stroke="#CBC4B6" strokeWidth="0.5" />
    </svg>
  )
}
