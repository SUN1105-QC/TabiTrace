/** 底部署名：左侧小号编号，右侧 40px 细线 + Made with 旅迹 TabiTrace。海报主体永远是用户的旅行。 */

import type { TripView } from '@/services/tabitrace-api'
import { placeLabelEn } from '@/utils/share-long'

export function PosterSignature({ trip }: { trip: TripView }) {
  return (
    <footer className="tp-sign">
      <span>No.{String(trip.id).padStart(3, '0')} · {placeLabelEn(trip).toUpperCase()}</span>
      <span className="tp-sign-brand"><i />Made with 旅迹 TabiTrace</span>
    </footer>
  )
}
