/** 城市印象收尾：氛围背景图 + 城市名 + 旅行者自己的最后一句话 + 品牌。 */

import type { TimelineDay, TripView } from '@/services/tabitrace-api'
import { cityOf, closingQuote, placeLabelEn } from '@/utils/share-long'

export function ShareResultFooter({ trip, timeline, image }: { trip: TripView; timeline: TimelineDay[]; image?: string }) {
  const quote = closingQuote(timeline)
  return (
    <footer className="sl-footer">
      {image && <img src={image} crossOrigin="anonymous" alt="" />}
      <div className="sl-footer-shade" />
      <div className="sl-footer-body">
        <span className="sl-footer-kicker">CITY MEMORY</span>
        <h3>{cityOf(trip)}</h3>
        <em>{placeLabelEn(trip)}</em>
        <i className="sl-footer-rule" />
        <blockquote>“{quote.text}”</blockquote>
        {quote.place && <span className="sl-footer-note">—— 写于 {quote.place}</span>}
      </div>
      <div className="sl-brand">
        <span className="sl-brand-mark">旅</span>
        <span><b>旅迹 TabiTrace</b><small>Every Journey · A Better You</small></span>
      </div>
    </footer>
  )
}
