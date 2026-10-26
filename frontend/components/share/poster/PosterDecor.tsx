/**
 * 海报上的季节装饰（2~4 个，克制）：秋天枫叶、春天樱花瓣、夏天绿叶、冬天雪花。
 * 季节由旅行日期决定（见 poster-data.seasonOf），只做装饰，不出现在任何文字里。
 */

import type { Season } from '@/utils/poster-data'

const MAPLE = 'M50 4 L57 27 L73 16 L67 38 L92 33 L76 50 L86 59 L59 61 L61 82 L52 71 L50 96 L48 71 L39 82 L41 61 L14 59 L24 50 L8 33 L33 38 L27 16 L43 27 Z'

function Shape({ season, tone }: { season: Season; tone: number }) {
  if (season === 'autumn') {
    const fill = tone % 2 ? '#D96C32' : '#C95E2C'
    return (
      <>
        <path d={MAPLE} fill={fill} fillOpacity=".86" />
        <path d="M50 96 L50 30 M50 58 L28 42 M50 58 L72 42 M50 70 L36 64 M50 70 L64 64" stroke="#8E3E18" strokeWidth="1.2" fill="none" opacity=".55" />
      </>
    )
  }
  if (season === 'spring') {
    return (
      <g fill="#E9A9B3" fillOpacity=".9">
        {[0, 72, 144, 216, 288].map(r => <path key={r} d="M50 50 C 40 30, 44 14, 50 20 C 56 14, 60 30, 50 50 Z" transform={`rotate(${r} 50 50)`} />)}
        <circle cx="50" cy="50" r="5" fill="#D9707F" />
      </g>
    )
  }
  if (season === 'summer') {
    return (
      <>
        <path d="M14 86 C 20 40, 52 12, 88 10 C 84 48, 56 80, 14 86 Z" fill="#7E9C6B" fillOpacity=".85" />
        <path d="M14 86 C 40 60, 60 38, 86 12" stroke="#4E6B42" strokeWidth="1.3" fill="none" opacity=".6" />
      </>
    )
  }
  return (
    <g stroke="#8FA3AE" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".85">
      {[0, 60, 120].map(r => <path key={r} d="M50 12 L50 88 M50 26 L42 18 M50 26 L58 18 M50 74 L42 82 M50 74 L58 82" transform={`rotate(${r} 50 50)`} />)}
    </g>
  )
}

export function PosterDecor({ season, items }: { season: Season; items: { x: number; y: number; size: number; rot: number }[] }) {
  return (
    <div className="cp-decor" aria-hidden>
      {items.map((it, i) => (
        <svg key={i} width={it.size} height={it.size} viewBox="0 0 100 100" style={{ left: it.x, top: it.y, transform: `rotate(${it.rot}deg)` }}>
          <Shape season={season} tone={i} />
        </svg>
      ))}
    </div>
  )
}
