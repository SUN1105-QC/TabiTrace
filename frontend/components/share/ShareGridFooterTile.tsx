/** 格子 9：品牌收尾格。橙色底 + 城市名 + 一句收尾文案 + 署名，作为整张图的落点。 */

import type { TripView } from '@/services/tabitrace-api'
import { cityEn, cityOf } from '@/utils/share-long'
import { ShareGridTile } from './ShareGridTile'

export function ShareGridFooterTile({ trip }: { trip: TripView }) {
  const city = cityOf(trip)
  const en = cityEn(trip)
  return (
    <ShareGridTile variant="footer">
      <span className="sg-footer-ring" />
      <div className="sg-footer-body">
        <h3>{city}</h3>
        {en !== city && <em>{en}</em>}
        <i className="sg-footer-rule" />
        <p>把这一段风景，收进记忆里。</p>
      </div>
      <span className="sg-footer-brand">Made with <b>旅迹 TabiTrace</b></span>
    </ShareGridTile>
  )
}
