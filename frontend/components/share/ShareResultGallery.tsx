/** 旅途剪影：精选照片拼图（1 大 + 最多 4 小），照片不足 3 张时不显示。 */

import type { PhotoView } from '@/services/tabitrace-api'
import { galleryPhotos } from '@/utils/share-long'

export function ShareResultGallery({ photos }: { photos: PhotoView[] }) {
  const picks = galleryPhotos(photos, 5)
  if (picks.length < 3) return null
  return (
    <section className="sl-section sl-gallery-wrap">
      <div className="sl-heading">
        <span>SNAPSHOTS</span>
        <h3>旅途剪影</h3>
      </div>
      <div className={`sl-gallery count-${picks.length}`}>
        {picks.map((p, i) => (
          <figure key={p.id} className={i === 0 ? 'is-main' : ''}>
            <img src={p.imageUrl} crossOrigin="anonymous" alt="旅行照片" />
          </figure>
        ))}
      </div>
    </section>
  )
}
