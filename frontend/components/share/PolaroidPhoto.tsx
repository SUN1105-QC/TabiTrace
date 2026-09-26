/** 拍立得：白色打印边框 + 顶部半透明纸胶带 + 底部手写地点、那次打卡写下的话与日期，带轻微旋转。 */

import { dotDate } from '@/utils/share-long'
import type { PosterPhoto } from '@/utils/share-poster'

export function PolaroidPhoto({ photo, tilt, className = '' }: { photo: PosterPhoto; tilt: number; className?: string }) {
  return (
    <figure className={`tp-polaroid ${className}`} style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="tp-tape" />
      <img src={photo.url} crossOrigin="anonymous" alt={photo.place ?? '旅行照片'} />
      <figcaption>
        {photo.place && <b>{photo.place}</b>}
        {photo.note && <em>{photo.note}</em>}
        {photo.date && <span>{dotDate(photo.date)}</span>}
      </figcaption>
    </figure>
  )
}
