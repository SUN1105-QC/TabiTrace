/**
 * 照片格：统一 1:1 裁切与色调，底部渐变遮罩里标出拍摄地点（加粗）、城市 · 区域（小字）与 DAY · 时间。
 * 地点来自关联的打卡；没有关联打卡的照片只显示拍摄时间（有的话），不编造地点。
 */

import { MapPin } from 'lucide-react'
import type { PhotoView, TripView } from '@/services/tabitrace-api'
import { materialOf, materialWhen, type GridPlace } from '@/utils/share-grid'
import { photoMedium } from '@/utils/photo-variants'
import { ShareGridTile, type GridTileEdit } from './ShareGridTile'

export function ShareGridImageTile({ photo, places, trip, edit }: { photo: PhotoView; places: Map<number, GridPlace>; trip: TripView; edit?: GridTileEdit }) {
  const m = materialOf(photo, places, trip)
  const when = materialWhen(m)
  return (
    <ShareGridTile variant="image" edit={edit}>
      <img src={photoMedium(photo)} crossOrigin="anonymous" alt={m.placeName ?? '旅行照片'} />
      {(m.placeName || when) && (
        <span className="sg-caption">
          {when && <small>{when}</small>}
          {m.placeName && <b><MapPin aria-hidden="true" />{m.placeName}</b>}
          {m.address && <i>{m.address}</i>}
        </span>
      )}
    </ShareGridTile>
  )
}
