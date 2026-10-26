'use client'

/**
 * 底部左侧拍立得（0~2 张）：暖白相纸、顶部半透明胶带、轻微旋转（-3° / 3°），下方手写地点、打卡文字与日期。
 * 照片加载失败时只隐藏那一张的图片区，不影响导出。
 */

import { useState } from 'react'
import { dotDate } from '@/utils/share-long'
import { clip, type PosterPhoto } from '@/utils/poster-data'

function Polaroid({ photo, tilt, index }: { photo: PosterPhoto; tilt: number; index: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <figure className={`cp-polaroid is-${index + 1}`} style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="cp-tape" />
      <div className="cp-polaroid-photo">
        {failed ? <span className="cp-photo-fallback">照片暂时无法加载</span>
          : <img src={photo.url} crossOrigin="anonymous" alt={photo.place ?? '旅行照片'} onError={() => setFailed(true)} />}
      </div>
      <figcaption>
        {photo.place && <b>{photo.place}</b>}
        {photo.note && <em>{clip(photo.note, 14)}</em>}
        {photo.date && <span>{dotDate(photo.date)}</span>}
      </figcaption>
    </figure>
  )
}

export function PosterPolaroids({ photos }: { photos: PosterPhoto[] }) {
  if (!photos.length) return null
  return (
    <div className={`cp-polaroids is-${photos.length}`}>
      {photos.map((p, i) => <Polaroid key={p.id} photo={p} index={i} tilt={i === 0 ? -3 : 3} />)}
    </div>
  )
}
