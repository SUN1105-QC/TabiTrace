/**
 * 回忆封面：优先用后端解析好的封面（trip.coverImage → 精选照片 → 第一张照片）；
 * 都没有时显示目的地文字封面，不随意套用别的旅行照片。
 */

export function MemoryCover({ src, city, title, className = '' }: { src?: string | null; city: string; title: string; className?: string }) {
  if (src) return <span className={`mm-cover ${className}`}><img src={src} alt={`${title} 封面`} loading="lazy" /></span>
  return (
    <span className={`mm-cover is-text ${className}`} aria-label={`${title} 封面`}>
      <small>TRAVEL MEMORY</small>
      <b>{city}</b>
    </span>
  )
}
