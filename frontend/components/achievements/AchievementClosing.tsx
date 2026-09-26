/** 底部两张行动卡：下一枚徽章（真实剩余目标数）与城市收藏进度。 */

import Link from 'next/link'
import { ArrowRight, Compass, Map as MapIcon } from 'lucide-react'
import type { CityCollection } from '@/utils/achievements'

export function AchievementClosing({ remaining, exploreHref, city }: { remaining: number; exploreHref: string; city?: CityCollection }) {
  return (
    <section className="ac-closing">
      <div className="ac-closing-card is-warm">
        <Compass size={20} />
        <h3>下一枚徽章，在下一段路上。</h3>
        <p>{remaining > 0 ? `还有 ${remaining} 个目标等待完成。` : '这段旅行的成就已经全部收入囊中。'}</p>
        <Link href={exploreHref} className="ac-action is-primary">继续探索 <ArrowRight size={13} /></Link>
      </div>
      {city && (
        <div className="ac-closing-card">
          <MapIcon size={20} />
          <h3>{city.name}成就收藏</h3>
          <p><b>{city.unlocked} / {city.achievements.length}</b> · {city.unlocked === city.achievements.length ? '已经全部收集' : `还差 ${city.achievements.length - city.unlocked} 枚`}</p>
          {city.explore && <Link href={city.explore} className="ac-action">查看{city.name}推荐探索 <ArrowRight size={13} /></Link>}
        </div>
      )}
    </section>
  )
}
