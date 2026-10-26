/**
 * 右上主照片：纸质照片框 + 底部「PHOTO 01 · 地点 · 日期」+ 右上角城市邮戳。
 * 没有照片时不留空框，纸面上竖排城市名作为主视觉；照片加载失败时同样退回城市名。
 */

'use client'

import { useState } from 'react'
import { dotDate } from '@/utils/share-long'
import type { PosterData } from '@/utils/poster-data'
import { PosterStamp } from './PosterStamp'

export function PosterHero({ data, tripId }: { data: PosterData; tripId: number }) {
  const [failed, setFailed] = useState<number | null>(null)
  const photo = data.mainPhoto && failed !== data.mainPhoto.id ? data.mainPhoto : undefined
  const caption = [photo?.place, photo?.date ? dotDate(photo.date) : ''].filter(Boolean)
  return (
    <figure className={`cp-hero${photo ? '' : ' is-empty'}`}>
      <div className="cp-hero-photo">
        {photo
          ? <img src={photo.url} crossOrigin="anonymous" alt={photo.place ?? data.cityName} onError={() => setFailed(photo.id)} />
          : <span className="cp-hero-kanji"><b>{data.cityKanji}</b><small>{data.cityNameEn.toUpperCase()}</small></span>}
      </div>
      {photo && <figcaption><span>PHOTO 01</span>{caption.map(c => <span key={c}>{c}</span>)}</figcaption>}
      <PosterStamp id={`cp-hero-ring-${tripId}`} className="cp-hero-stamp" size={118}
        ring={`${data.cityNameEn.toUpperCase()} · ${(data.day?.date ?? data.startDate).slice(0, 4)} · TRAVEL NOTES · `}
        main={data.cityKanji} sub={data.cityNameEn !== data.cityName ? data.cityNameEn.toUpperCase() : undefined} />
    </figure>
  )
}
