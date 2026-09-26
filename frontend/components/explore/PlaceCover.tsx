/**
 * 地点封面：有能确认就是该地点的站内图片就用图片，
 * 没有就显示文字封面（地点名 + 区域，按类别换底色），不借用别处的照片冒充。
 */

import type { PlaceView } from '@/services/tabitrace-api'
import { coverTone } from '@/utils/explore'

export function PlaceCover({ place, className = '' }: { place: PlaceView; className?: string }) {
  if (place.coverImage) {
    return (
      <span className={`ex-cover ${className}`}>
        <img src={place.coverImage} alt={place.name} loading="lazy" />
      </span>
    )
  }
  return (
    <span className={`ex-cover is-text tone-${coverTone(place)} ${className}`} aria-label={place.name}>
      <small>TOKYO · {place.category}</small>
      <b>{place.area ?? '东京'}</b>
      <i>{place.name}</i>
    </span>
  )
}
