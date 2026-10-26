/** 左上：TRAVEL NOTES 编号 + 细线 → 两行宋体主标题（末尾强调色）→ 英文斜体副标题 → 日期。 */

import { dotDate, weekdayOf } from '@/utils/share-long'
import type { PosterData } from '@/utils/poster-data'

export function PosterHeader({ data }: { data: PosterData }) {
  const en = data.cityNameEn !== data.cityName ? `${data.cityNameEn} Notes` : 'Travel Notes'
  return (
    <header className="cp-head">
      <p className="cp-eyebrow"><span>TRAVEL NOTES</span><span>No.{data.tripNumber}</span><i /></p>
      <h2 className="cp-title" style={{ fontSize: data.titleSize }}>
        {data.titleLines.map((l, i) => <span key={i}>{l.text}{l.accent && <em>{l.accent}</em>}</span>)}
      </h2>
      <p className="cp-en">{en}</p>
      <p className="cp-date">
        {data.day ? <><span>{dotDate(data.day.date)} {weekdayOf(data.day.date)}</span><i /><span>DAY {String(data.day.no).padStart(2, '0')}</span></>
          : <><span>{dotDate(data.startDate)}</span><i /><span>{dotDate(data.endDate)}</span></>}
      </p>
    </header>
  )
}

/** 一句旅行文字；打卡文字带出处（写于 · 地点 · 时间段 · 天气），自己写的一句不加出处 */
export function PosterQuote({ text, source }: { text: string; source?: string }) {
  return (
    <figure className="cp-quote">
      <blockquote>“{text}”</blockquote>
      {source && <figcaption>—— {source}</figcaption>}
    </figure>
  )
}
