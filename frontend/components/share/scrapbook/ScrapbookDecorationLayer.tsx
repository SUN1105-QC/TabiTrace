/**
 * 旅行手帐的装饰层：与照片分开的独立图层，全部 pointer-events: none。
 * - back：纸张上的淡等高线地图纹理（在照片卡之下）
 * - front：邮戳、虚线航线、纸胶带、一枝叶子（在照片卡之上）
 * 位置都按模板数据计算：邮戳与航线在标题区右侧（标题宽度有上限，不会被盖住），
 * 纸胶带只贴在照片卡的上边缘纸边处，叶子在品牌区左侧空白，不遮挡照片主体、地点、标题与日期。
 * 城市与日期来自真实旅行，不写死任何目的地或季节。
 */

import type { TripView } from '@/services/tabitrace-api'
import { dotDate } from '@/utils/share-long'
import { SB_HEIGHT, SB_WIDTH, scrapStampCity, type ScrapSlot } from '@/utils/share-scrapbook'

/** 纸胶带：贴在主图与另外两张卡的上边缘（卡片少时只贴有的那几张） */
function tapes(slots: ScrapSlot[]) {
  const picks = [0, 2, 6].filter(i => slots[i])
  return picks.map((i, k) => {
    const s = slots[i]
    const w = s.hero ? 128 : 96
    return { x: s.x + s.w / 2 - w / 2 + (k === 1 ? -s.w * 0.22 : k === 2 ? s.w * 0.18 : 0), y: s.y - 15, w, rot: s.rot + (k % 2 ? 7 : -5), tone: k === 0 ? 'is-orange' : 'is-cream' }
  })
}

function Stamp({ trip, date }: { trip: TripView; date: string }) {
  const ring = `${scrapStampCity(trip)} · TABITRACE · ${date.slice(0, 4)} · `
  const id = `sb-ring-${trip.id}`
  return (
    <svg className="sb-stamp" width="132" height="132" viewBox="0 0 96 96" aria-hidden>
      <defs><path id={id} d="M48 48 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" /></defs>
      <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 1.6" />
      <circle cx="48" cy="48" r="25" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <text fontFamily="Inter, sans-serif" fontSize="7.2" fill="currentColor"><textPath href={`#${id}`} textLength="210" lengthAdjust="spacing">{ring}</textPath></text>
      <text x="48" y="47" textAnchor="middle" fontFamily={'"Noto Serif SC", Georgia, serif'} fontSize="15" fill="currentColor">{dotDate(date).slice(5)}</text>
      <text x="48" y="59" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="6.6" letterSpacing="1.4" fill="currentColor">{date.slice(0, 4)}</text>
    </svg>
  )
}

/** 从邮戳出发的一段虚线航线，末端一架小飞机 */
function Route() {
  return (
    <svg className="sb-route" width="300" height="120" viewBox="0 0 300 120" aria-hidden>
      <path d="M290 18 C 230 92, 120 112, 18 70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 7" strokeLinecap="round" />
      <path d="M12 66 l14 -1.5 l5 -7 l3 1 l-2.6 7 l9 -0.8 l3 -3.6 l2.4 0.6 l-1.6 4.6 l1.8 4.4 l-2.4 0.5 l-3.1 -3.4 l-9 0.4 l3 6.8 l-3 1 l-5.4 -6.8 l-14 -0.6 z" fill="currentColor" transform="rotate(-8 22 66)" />
    </svg>
  )
}

function Leaf() {
  return (
    <svg className="sb-leaf" width="86" height="110" viewBox="0 0 70 92" aria-hidden>
      <path d="M10 88 C 22 64, 34 40, 60 6" fill="none" stroke="currentColor" strokeWidth="1" />
      {[[18, 70, -52], [26, 55, 38], [33, 42, -48], [42, 30, 42], [50, 19, -44]].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="9" ry="3.6" transform={`rotate(${r} ${x} ${y}) translate(${r > 0 ? 7 : -7} 0)`} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="0.8" />
      ))}
    </svg>
  )
}

/** 淡淡的等高线：几组同心的不规则闭合曲线，像旅行地图的底纹 */
function Contours() {
  const rings = (cx: number, cy: number, n: number, r0: number) => Array.from({ length: n }, (_, i) => {
    const r = r0 + i * 26
    return `M${cx - r} ${cy} C ${cx - r} ${cy - r * 0.7}, ${cx + r * 0.9} ${cy - r * 0.8}, ${cx + r} ${cy - r * 0.05} S ${cx + r * 0.2} ${cy + r * 0.75}, ${cx - r} ${cy} Z`
  })
  return (
    <svg className="sb-contours" width={SB_WIDTH} height={SB_HEIGHT} viewBox={`0 0 ${SB_WIDTH} ${SB_HEIGHT}`} aria-hidden>
      {[...rings(140, 420, 6, 30), ...rings(960, 1120, 7, 34), ...rings(560, 1330, 4, 40)].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  )
}

export function ScrapbookDecorationLayer({ layer, trip, date, slots }: { layer: 'back' | 'front'; trip: TripView; date: string; slots: ScrapSlot[] }) {
  if (layer === 'back') return <div className="sb-deco is-back" aria-hidden><Contours /></div>
  return (
    <div className="sb-deco is-front" aria-hidden>
      <Stamp trip={trip} date={date} />
      <Route />
      {tapes(slots).map((t, i) => (
        <span key={i} className={`sb-tape ${t.tone}`} style={{ left: t.x, top: t.y, width: t.w, transform: `rotate(${t.rot}deg)` }} />
      ))}
      <Leaf />
    </div>
  )
}
