/**
 * 底部右侧旅行路线：轻量 SVG（抽象街道纹理 + 少量线稿建筑），不用在线地图截图，导出不受跨域与地图版权影响。
 * 路线点来自 PosterData.route（打卡按时间先后、有坐标的地点），按经纬度等比投影进画框；
 * 地点名标签依次尝试右 / 左 / 上 / 下，避开已放好的标签；线稿只放在离路线最远的空白角落。
 * 没有坐标时只保留纹理和城市名，不画假路线。
 */

import { dotDate } from '@/utils/share-long'
import { roadTexture } from '@/utils/share-poster'
import type { PosterData, PosterRoutePoint } from '@/utils/poster-data'
import { PosterStamp } from './PosterStamp'

// 文字样式直接写成 SVG 属性：导出 PNG 时 html-to-image 不会带上 SVG 文字的 CSS 类样式
const SANS = 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif'
const INK = '#2F4A3C'
const ACCENT = '#C95E2C'
const PAPER = '#F1EBDF'
const MAX_POINTS = 8
const FONT = 15

type Pt = PosterRoutePoint & { x: number; y: number }
type Box = { x: number; y: number; w: number; h: number }
type Label = { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: Box }

/** 多于 MAX_POINTS 个地点时均匀抽取（保留首尾），再按纬度余弦压缩经度后等比投影 */
export function projectRoute(route: PosterRoutePoint[], width: number, height: number, pad = 44): Pt[] {
  const picked = route.length <= MAX_POINTS ? route : Array.from({ length: MAX_POINTS }, (_, i) => route[Math.round((i * (route.length - 1)) / (MAX_POINTS - 1))])
  if (!picked.length) return []
  const k = Math.cos((picked.reduce((s, p) => s + p.lat, 0) / picked.length) * Math.PI / 180)
  const raw = picked.map(p => ({ x: p.lng * k, y: -p.lat }))
  const xs = raw.map(p => p.x), ys = raw.map(p => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const spanX = maxX - minX, spanY = maxY - minY
  const scale = spanX || spanY ? Math.min((width - pad * 2) / (spanX || 1e-9), (height - pad * 2) / (spanY || 1e-9)) : 0
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2
  return picked.map((p, i) => ({ ...p, x: offX + (raw[i].x - minX) * scale, y: offY + (raw[i].y - minY) * scale }))
}

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
/** 标签宽度估算：编号「01 」约 22px，地名中文按字号、西文约 0.6 倍字号，另加描边余量 */
const labelWidth = (name: string) => 22 + Array.from(name).reduce((w, ch) => w + (/[\u0000-ÿ]/.test(ch) ? FONT * 0.6 : FONT), 0) + 6
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/**
 * 地名标签：依次尝试 右 / 左 / 上 / 下 / 四个斜角（近、远两档），取第一个不出框、不压住其他标签和圆点的位置；
 * 地点挤在一起实在放不下时，取重叠面积最小的位置。
 */
function placeLabels(points: Pt[], width: number, height: number, blocked: Box): Label[] {
  const placed: Label[] = []
  const dots = [...points.map(p => ({ x: p.x - 8, y: p.y - 8, w: 16, h: 16 })), blocked]
  const h = FONT + 8
  points.forEach(p => {
    const w = labelWidth(p.name)
    const at = (dx: number, dy: number, anchor: Label['anchor']): Label => {
      const left = anchor === 'start' ? p.x + dx : anchor === 'end' ? p.x + dx - w : p.x + dx - w / 2
      return { x: p.x + dx, y: p.y + dy, anchor, box: { x: left - 2, y: p.y + dy - FONT - 2, w: w + 4, h } }
    }
    const options: Label[] = [
      at(12, 5, 'start'), at(-12, 5, 'end'), at(0, -14, 'middle'), at(0, 26, 'middle'),
      at(10, -12, 'start'), at(10, 22, 'start'), at(-10, -12, 'end'), at(-10, 22, 'end'),
      at(14, -30, 'start'), at(14, 40, 'start'), at(-14, -30, 'end'), at(-14, 40, 'end')
    ]
    const inside = (b: Box) => b.x >= 4 && b.y >= 4 && b.x + b.w <= width - 4 && b.y + b.h <= height - 4
    const clash = (b: Box) => placed.reduce((s, l) => s + area(l.box, b), 0) + dots.reduce((s, d, j) => s + (points[j] !== p ? area(d, b) : 0), 0)
    const fits = options.filter(o => inside(o.box))
    placed.push(fits.find(o => clash(o.box) === 0) ?? [...fits].sort((a, b) => clash(a.box) - clash(b.box))[0] ?? options[0])
  })
  return placed
}

/** 线稿：通用的城市建筑、一棵树；日本的旅行多一座鸟居。每个 64 × 64 */
function Sketch({ kind }: { kind: 'buildings' | 'tree' | 'torii' }) {
  if (kind === 'tree') return <g><circle cx="32" cy="24" r="16" /><circle cx="22" cy="30" r="10" /><circle cx="42" cy="30" r="10" /><path d="M32 40 V62 M32 50 L25 44 M32 54 L39 47" /></g>
  if (kind === 'torii') return <g><path d="M6 14 Q32 6 58 14 M10 22 H54 M16 14 V62 M48 14 V62 M30 14 V22 M34 14 V22" /></g>
  return <g><path d="M4 62 H60 M8 62 V30 H22 V62 M22 62 V14 H38 V62 M38 62 V36 H56 V62" /><path d="M12 36 h6 M12 44 h6 M12 52 h6 M26 20 h8 M26 28 h8 M26 36 h8 M26 44 h8 M26 52 h8 M42 42 h10 M42 50 h10" opacity=".7" /></g>
}

function sketchSpots(points: Pt[], labels: Label[], width: number, height: number, japan: boolean, stampLeft: boolean) {
  const kinds = japan ? (['torii', 'buildings', 'tree'] as const) : (['buildings', 'tree'] as const)
  // 邮戳压在左上或右上角，那个角不放线稿
  const candidates = [[18, height - 82], [width - 82, height - 82], [width - 82, 18], [18, 18], [width / 2 - 32, height - 82], [width / 2 - 32, 18]]
    .filter(([x, y]) => !(y < 100 && (stampLeft ? x < 140 : x > width - 140)))
  const free = (x: number, y: number) => {
    const b = { x, y, w: 64, h: 64 }
    return !labels.some(l => overlap(l.box, b)) && !points.some(p => overlap({ x: p.x - 10, y: p.y - 10, w: 20, h: 20 }, b))
  }
  const dist = ([x, y]: number[]) => (points.length ? Math.min(...points.map(p => Math.hypot(p.x - x - 32, p.y - y - 32))) : 999)
  return candidates.filter(([x, y]) => free(x, y)).sort((a, b) => dist(b) - dist(a)).slice(0, kinds.length).map((c, i) => ({ x: c[0], y: c[1], kind: kinds[i] }))
}

export function PosterRouteMap({ data, tripId, width, height }: { data: PosterData; tripId: number; width: number; height: number }) {
  const points = projectRoute(data.route, width, height)
  // 邮戳放在路线最少的上角，标签避开邮戳压住的那一块
  const leftCrowd = points.filter(p => p.x < 170 && p.y < 150).length
  const rightCrowd = points.filter(p => p.x > width - 170 && p.y < 150).length
  const stampLeft = leftCrowd <= rightCrowd
  const labels = placeLabels(points, width, height, { x: stampLeft ? 0 : width - 96, y: 0, w: 96, h: 76 })
  const roads = roadTexture(tripId, width, height, 11)
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const sketches = sketchSpots(points, labels, width, height, data.countryCode === 'JP', stampLeft)
  const from = data.day?.date ?? data.startDate
  const to = data.day?.date ?? data.endDate

  return (
    <div className="cp-route">
      <svg className="cp-map" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`旅行路线：${data.route.map(p => p.name).join('、') || '暂无坐标'}`}>
        <rect width={width} height={height} fill={PAPER} />
        <g fill="none" stroke="#CFC5B4" strokeLinecap="round">
          {roads.map((d, i) => <path key={i} d={d} strokeWidth={i % 4 === 1 ? 4 : 0.8} opacity={i % 4 === 1 ? 0.35 : 0.9} />)}
        </g>
        <g fill="none" stroke="#9A9183" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".75">
          {sketches.map((s, i) => <g key={i} transform={`translate(${s.x} ${s.y})`}><Sketch kind={s.kind} /></g>)}
        </g>
        {points.length === 0 ? (
          <text x={width / 2} y={height / 2 + 16} textAnchor="middle" fontFamily={SERIF} fontSize="52" letterSpacing="10" fill="rgba(47,74,60,.28)">{data.cityKanji}</text>
        ) : (
          <>
            {points.length > 1 && <path d={path} fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
            {points.map((p, i) => (
              <g key={p.order}>
                <circle cx={p.x} cy={p.y} r="6.5" fill={ACCENT} stroke={PAPER} strokeWidth="2.5" />
                <text x={labels[i].x} y={labels[i].y} textAnchor={labels[i].anchor} fontFamily={SANS} fontSize={FONT} fill={INK} stroke={PAPER} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
                  <tspan fontSize="12" fontWeight="700" fill={ACCENT}>{String(p.order).padStart(2, '0')} </tspan>{p.name}
                </text>
              </g>
            ))}
          </>
        )}
        <rect x="0.5" y="0.5" width={width - 1} height={height - 1} fill="none" stroke="#CFC5B4" />
      </svg>
      <PosterStamp id={`cp-route-ring-${tripId}`} className={`cp-route-stamp${stampLeft ? ' is-left' : ' is-right'}`} size={96} waves={false}
        ring={`${data.placeEn.toUpperCase()} · ROUTE · `} main={dotDate(from).slice(5)} sub={from !== to ? `→ ${dotDate(to).slice(5)}` : from.slice(0, 4)} />
      <p className="cp-route-caption">
        <span className="cp-hand">{data.placeEn}</span>
        <small>ROUTE · {from === to ? dotDate(from) : `${dotDate(from)} - ${dotDate(to)}`}</small>
      </p>
    </div>
  )
}
