/**
 * 地点封面：有能确认就是该地点的官方图片就用图片（640 / 1280 / 1920 / 2560 四档按 sizes 选择），
 * 没有就显示文字封面（地点名 + 区域，按类别换底色），不借用别处的照片冒充。
 * 封面固定宽高比（由外层 CSS 决定），加载前显示暖灰底色，加载前后高度不变。
 */

import type { PlaceView } from '@/services/tabitrace-api'
import { PlaceImage } from '@/components/common/PlaceImage'
import { coverTone } from '@/utils/explore'

/** 常用的显示宽度：卡片网格、推荐三列、详情抽屉、专题途经地点的小方图 */
export const COVER_SIZES = {
  // 手机上是左图右文的紧凑卡：图片框约 118×166，按 cover 铺满时需要约 220px 宽的图
  grid: '(max-width: 767px) 240px, (max-width: 1023px) 50vw, (max-width: 1366px) 25vw, (max-width: 1920px) 20vw, 16vw',
  recommend: '(max-width: 767px) 78vw, (max-width: 1023px) 50vw, 33vw',
  detail: '(max-width: 767px) 100vw, 460px',
  thumb: '64px'
} as const

export function PlaceCover({ place, className = '', eager = false, sizes = COVER_SIZES.grid }: { place: PlaceView; className?: string; eager?: boolean; sizes?: string }) {
  if (place.coverImage) {
    return (
      <span className={`ex-cover ${className}`}>
        <PlaceImage src={place.coverImage} alt={place.name} sizes={sizes} eager={eager} />
      </span>
    )
  }
  return (
    <span className={`ex-cover is-text tone-${coverTone(place)} ${className}`} role="img" aria-label={place.name}>
      <small>TOKYO · {place.category}</small>
      <b>{place.area ?? '东京'}</b>
      <i>{place.name}</i>
    </span>
  )
}
