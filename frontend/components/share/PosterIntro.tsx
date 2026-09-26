/** 左上文字区：眉题 → 两行宋体主标题 → 宽字距英文副标题 → 日期 → 用户自己写的一段手写笔记。 */

import type { TripView } from '@/services/tabitrace-api'
import { cityEn, cityOf, dotDate, weekdayOf } from '@/utils/share-long'
import { titleFontSize, titleLines } from '@/utils/share-poster'
import type { PosterDay } from './TravelPoster'

export function PosterTitle({ trip }: { trip: TripView }) {
  const lines = titleLines(trip.title, cityOf(trip))
  return (
    <div className="tp-title">
      <span className="tp-eyebrow">TRAVEL NOTES <i>No.{String(trip.id).padStart(3, '0')}</i></span>
      <h2 style={{ fontSize: titleFontSize(lines) }}>
        {lines.map(l => <span key={l}>{l}</span>)}
      </h2>
      <p className="tp-subtitle">{cityEn(trip)} Notes</p>
    </div>
  )
}

/** 整趟旅行显示起止日期；单日海报显示那一天、星期与 DAY 编号 */
export function PosterDate({ trip, day }: { trip: TripView; day?: PosterDay }) {
  return (
    <p className="tp-date">
      <span>{dotDate(day ? day.date : trip.startDate)}{day && ` · ${weekdayOf(day.date)}`}</span>
      <i />
      <span>{day ? `DAY ${String(day.no).padStart(2, '0')}` : dotDate(trip.endDate)}</span>
    </p>
  )
}

/** 打卡文字注明写于哪里；用户在海报素材里亲手写的一句不加出处 */
export function PosterQuote({ quote }: { quote: { text: string; place?: string } }) {
  return (
    <figure className="tp-quote">
      <blockquote>“{quote.text}”</blockquote>
      {quote.place && <figcaption>— 写于 {quote.place}</figcaption>}
    </figure>
  )
}

export function PosterIntro({ trip, quote, day }: { trip: TripView; quote?: { text: string; place?: string }; day?: PosterDay }) {
  return (
    <section className="tp-intro">
      <div>
        <PosterTitle trip={trip} />
        <PosterDate trip={trip} day={day} />
      </div>
      {quote && <PosterQuote quote={quote} />}
    </section>
  )
}
