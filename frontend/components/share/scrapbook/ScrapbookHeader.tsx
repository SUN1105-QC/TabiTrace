/**
 * 旅行手帐的标题区与品牌区。全部文字来自真实旅行：标题、城市英文名、日期、天数 / 照片 / 地点数，
 * 没有的数据不显示，不生成任何描述文案。
 */

import type { TripView } from '@/services/tabitrace-api'
import { BRAND_MARK } from '@/components/common/Brand'
import { dotDate, weekdayOf } from '@/utils/share-long'
import { scrapEnglish, scrapTitleSize } from '@/utils/share-scrapbook'

export type ScrapDay = { date: string; no: number }

export function ScrapbookHeader({ trip, day, days, photos, places }: { trip: TripView; day?: ScrapDay; days: number; photos: number; places: number }) {
  const stats = [day ? `DAY ${String(day.no).padStart(2, '0')}` : days > 0 ? `${days} 天` : '', photos > 0 ? `${photos} 张照片` : '', places > 0 ? `${places} 个地点` : ''].filter(Boolean)
  return (
    <header className="sb-head">
      <span className="sb-kicker">TABITRACE · TRAVEL SCRAPBOOK</span>
      <h2 style={{ fontSize: scrapTitleSize(trip.title) }}>{trip.title}</h2>
      <p className="sb-en">{scrapEnglish(trip)}</p>
      <p className="sb-dates">
        {day ? `${dotDate(day.date)} ${weekdayOf(day.date)}` : `${dotDate(trip.startDate)} — ${dotDate(trip.endDate)}`}
        {stats.length > 0 && <small>{stats.join(' · ')}</small>}
      </p>
    </header>
  )
}

/** 品牌区：免费旅行保留署名；Trip Pro 去水印时由分享工作台的 .ss-no-brand 隐藏 */
export function ScrapbookBrandFooter() {
  return (
    <footer className="sb-foot">
      <i className="sb-foot-rule" />
      <span className="sb-foot-line">用旅行，记录生活。</span>
      <span className="sb-foot-brand"><img src={BRAND_MARK} alt="" width={34} height={34} />旅迹 <b>TabiTrace</b></span>
    </footer>
  )
}
