/** 图片格：统一 1:1 裁切与色调，左下角用一行小字标出拍摄地点和第几天。 */

import type { PhotoView } from '@/services/tabitrace-api'
import type { GridPlace } from '@/utils/share-grid'
import { ShareGridTile } from './ShareGridTile'

export function ShareGridImageTile({ photo, place }: { photo: PhotoView; place?: GridPlace }) {
  return (
    <ShareGridTile variant="image">
      <img src={photo.imageUrl} crossOrigin="anonymous" alt={place?.checkin.placeName ?? '旅行照片'} />
      {place && (
        <span className="sg-caption">
          <small>DAY {String(place.day).padStart(2, '0')}</small>
          {place.checkin.placeName}
        </span>
      )}
    </ShareGridTile>
  )
}
