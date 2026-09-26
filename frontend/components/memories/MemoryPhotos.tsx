/**
 * 精选照片：优先今年归档旅行里的精选照片，再按拍摄时间由近到远，最多 8 张。
 * 项目里没有独立的照片查看器，点击进入对应旅行的照片页。
 */

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Star } from 'lucide-react'
import type { MemoryPhoto } from '@/services/memories'

/**
 * 网格：3 张及以上时第一张占 2×2，其余各占 1 格；最后一行不满时让最后一张横向补满，避免留空格。
 * 桌面 4 列、手机 2 列分别计算（通过 CSS 变量交给样式）。
 */
function spans(n: number) {
  if (n <= 2) return { lead: false, last: 4 / Math.max(n, 1), lastM: n === 1 ? 2 : 1 }
  const rem = (4 + n - 1) % 4
  return { lead: true, last: rem ? 5 - rem : 1, lastM: (n - 1) % 2 ? 2 : 1 }
}

export function MemoryPhotos({ photos, year }: { photos: MemoryPhoto[]; year: number }) {
  if (!photos.length) return null
  const s = spans(photos.length)
  return (
    <section className="mm-section" id="mm-photos">
      <header className="mm-section-head">
        <div>
          <p className="mm-eyebrow">{year ? `${year} HIGHLIGHTS` : 'HIGHLIGHTS'}</p>
          <h2>{year ? '这一年最值得回看的照片' : '最值得回看的照片'}</h2>
          <p>精选照片优先，点开可以回到那段旅行的相册。</p>
        </div>
      </header>
      <div className="mm-photos">
        {photos.map((p, i) => {
          const last = i === photos.length - 1
          const style = { '--span': last ? s.last : s.lead ? 1 : 4 / photos.length, '--span-m': last ? s.lastM : 1 } as CSSProperties
          return (
            <Link key={p.id} href={`/trips/${p.tripId}/gallery`} className={`mm-photo${i === 0 && s.lead ? ' is-lead' : ''}`} style={style} aria-label={`查看「${p.tripTitle}」的照片`}>
              <img src={p.imageUrl} alt="" loading="lazy" />
              {p.featured && <span className="mm-photo-star" title="精选"><Star size={11} /></span>}
              <span className="mm-photo-caption">{p.tripTitle}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
