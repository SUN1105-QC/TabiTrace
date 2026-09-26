/**
 * 下半部分剪贴簿：拍立得（0~2 张，按照片数量）+ 线稿路线图 + 手写地名 + 邮戳 + 一枝叶子。
 * 拍立得越少，路线图越宽，保证没有空白图片框。
 */

import type { TimelineDay, TripView } from '@/services/tabitrace-api'
import { cityEn, dotDate, placeLabelEn } from '@/utils/share-long'
import { routePoints, stampCorner, type PosterPhoto } from '@/utils/share-poster'
import { PolaroidPhoto } from './PolaroidPhoto'
import type { PosterDay } from './TravelPoster'
import { TravelMap } from './TravelMap'

/** 地图宽度随拍立得数量变化（海报内容区宽 752px） */
const MAP_WIDTH = { 0: 752, 1: 470, 2: 344 } as const
const MAP_HEIGHT = 236

/** 圆形邮戳：环形小字 + 中间日期，点缀色，轻微旋转 */
function PosterStamp({ trip, corner, date }: { trip: TripView; corner: string; date: string }) {
  const ring = `${cityEn(trip).toUpperCase()} · JOURNEY · ${trip.startDate.slice(0, 4)} · `
  return (
    <svg className={`tp-stamp is-${corner}`} width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <defs><path id={`tp-ring-${trip.id}`} d="M48 48 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" /></defs>
      <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="48" cy="48" r="25" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <text fontFamily="Inter, sans-serif" fontSize="7.4" fill="currentColor"><textPath href={`#tp-ring-${trip.id}`} textLength="210" lengthAdjust="spacing">{ring}</textPath></text>
      <text x="48" y="46" textAnchor="middle" fontFamily={'"Noto Serif SC", Georgia, serif'} fontSize="15" fill="currentColor">{dotDate(date).slice(5)}</text>
      <text x="48" y="58" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7" letterSpacing="1.4" fill="currentColor">{trip.startDate.slice(0, 4)}</text>
    </svg>
  )
}

/** 一枝细线叶子，装饰用 */
function Leaf() {
  return (
    <svg className="tp-leaf" width="70" height="92" viewBox="0 0 70 92" aria-hidden>
      <path d="M10 88 C 22 64, 34 40, 60 6" fill="none" stroke="currentColor" strokeWidth="1" />
      {[[18, 70, -52], [26, 55, 38], [33, 42, -48], [42, 30, 42], [50, 19, -44]].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="9" ry="3.6" transform={`rotate(${r} ${x} ${y}) translate(${r > 0 ? 7 : -7} 0)`} fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="0.8" />
      ))}
    </svg>
  )
}

export function PosterScrapbook({ trip, polaroids, timeline, day }: { trip: TripView; polaroids: PosterPhoto[]; timeline: TimelineDay[]; day?: PosterDay }) {
  const n = Math.min(polaroids.length, 2) as 0 | 1 | 2
  const corner = stampCorner(routePoints(timeline, MAP_WIDTH[n], MAP_HEIGHT), MAP_WIDTH[n], MAP_HEIGHT)
  return (
    <section className={`tp-scrap is-${n}`}>
      {n > 0 && (
        <div className="tp-polaroids">
          {polaroids.slice(0, 2).map((p, i) => (
            <PolaroidPhoto key={p.url} photo={p} tilt={i === 0 ? -4 : 3} className={`is-${i + 1}`} />
          ))}
          <Leaf />
        </div>
      )}
      <div className="tp-map-wrap">
        <TravelMap trip={trip} timeline={timeline} width={MAP_WIDTH[n]} height={MAP_HEIGHT} />
        <PosterStamp trip={trip} corner={corner} date={day?.date ?? trip.startDate} />
        <p className="tp-map-caption">
          <span className="tp-hand-en">{placeLabelEn(trip)}</span>
          <small>{day ? `DAY ${String(day.no).padStart(2, '0')} ROUTE · ${dotDate(day.date)}` : `ROUTE · ${dotDate(trip.startDate)}`}</small>
        </p>
        {n === 0 && <Leaf />}
      </div>
    </section>
  )
}
