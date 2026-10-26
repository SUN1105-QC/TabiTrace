/**
 * 分享成果 · 城市海报（导出 PNG 时只截取这一个节点 .cp-poster）。
 * 「旅行纪念册」版式，设计尺寸 1080 × 1440（3:4）：
 *   左上 编号 · 标题 · 英文 · 日期 · 一句旅行文字   右上 主照片 + 城市邮戳
 *   中部 四组旅行统计
 *   底部 拍立得（0~2 张）+ 旅行路线（拍立得越少，路线越宽）
 *   页脚 编号 · 城市 —— Made with 旅迹 TabiTrace
 * 只读 PosterData（utils/poster-data），不在组件里处理 API 原始数据。
 */

import type { PosterData } from '@/utils/poster-data'
import { PosterHeader, PosterQuote } from './PosterHeader'
import { PosterHero } from './PosterHero'
import { PosterStats } from './PosterStats'
import { PosterPolaroids } from './PosterPolaroids'
import { PosterRouteMap } from './PosterRouteMap'
import { PosterFooter } from './PosterFooter'
import { PosterDecor } from './PosterDecor'

export const POSTER_WIDTH = 1080
export const POSTER_HEIGHT = 1440
/** 底部区域：内容宽 968，拍立得区宽度随张数变化，路线图占其余部分 */
const BOTTOM_WIDTH = 968
const POLAROID_AREA = { 0: 0, 1: 300, 2: 500 } as const
const MAP_HEIGHT = 336

export function CityPoster({ data, tripId }: { data: PosterData; tripId: number }) {
  const n = Math.min(data.secondaryPhotos.length, 2) as 0 | 1 | 2
  const mapWidth = BOTTOM_WIDTH - POLAROID_AREA[n] - (n ? 28 : 0)
  // 装饰 2~4 个：标题右侧一个、拍立得旁一个；有文字时文字左侧再放两个
  // 标题右侧放得下就紧跟标题末尾，放不下（长标题）就挪到英文副标题右侧，不压字
  const titleRight = 64 + Math.max(...data.titleLines.map(l => Array.from(l.text + (l.accent ?? '')).length)) * data.titleSize
  const decor = [
    titleRight + 62 <= 516 ? { x: Math.max(titleRight + 6, 380), y: 150, size: 56, rot: 18 } : { x: 440, y: 340, size: 52, rot: 18 },
    ...(data.quote ? [{ x: 6, y: 560, size: 44, rot: -24 }, { x: 24, y: 612, size: 56, rot: 12 }] : []),
    ...(n ? [{ x: n === 2 ? 248 : 236, y: 1222, size: 60, rot: -16 }] : [{ x: 470, y: 640, size: 52, rot: -10 }])
  ]
  return (
    <article className="cp-poster" style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
      <div className={`cp-intro${data.quote ? '' : ' is-noquote'}`}>
        <PosterHeader data={data} />
        {data.quote && <PosterQuote text={data.quote} source={data.quoteSource} />}
      </div>
      <PosterHero data={data} tripId={tripId} />
      <PosterStats data={data} />
      <section className={`cp-bottom is-${n}`}>
        <PosterPolaroids photos={data.secondaryPhotos.slice(0, 2)} />
        <PosterRouteMap data={data} tripId={tripId} width={mapWidth} height={MAP_HEIGHT} />
      </section>
      <PosterFooter data={data} />
      <PosterDecor season={data.season} items={decor} />
    </article>
  )
}
