/**
 * 右上主摄影：低饱和暖调处理，右上角竖排城市名。
 * 没有任何照片时不留空框，改为纸面上的竖排城市名作为主视觉。
 */

import type { TripView } from '@/services/tabitrace-api'
import { cityEn, dotDate } from '@/utils/share-long'
import { cityKanji, type PosterPhoto } from '@/utils/share-poster'

export function PosterHeroPhoto({ trip, photo }: { trip: TripView; photo?: PosterPhoto }) {
  const en = cityEn(trip).toUpperCase()
  if (!photo) {
    return (
      <figure className="tp-hero is-empty">
        <b className="tp-hero-kanji">{cityKanji(trip)}</b>
        <span className="tp-hero-en">{en}</span>
      </figure>
    )
  }
  return (
    <figure className="tp-hero">
      <div className="tp-hero-frame">
        <img src={photo.url} crossOrigin="anonymous" alt={photo.place ?? cityKanji(trip)} />
        <div className="tp-hero-mark">
          <b>{cityKanji(trip)}</b>
          <span>{en}</span>
          <small>CITY OF MANY STORIES</small>
        </div>
      </div>
      <figcaption>
        <span>PHOTO 01</span>
        {photo.place && <span>{photo.place}</span>}
        {photo.date && <span>{dotDate(photo.date)}</span>}
      </figcaption>
    </figure>
  )
}
