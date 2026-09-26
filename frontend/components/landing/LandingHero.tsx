/**
 * 首页首屏：左侧说明产品，右侧是一组“旅行回忆”组合（主图、打卡卡片、路线、照片、Travel Story 画面）。
 * 不再使用自带大字的海报图做背景；首屏主图不懒加载（LCP），其余小图正常加载。
 */

import Link from 'next/link'
import { ArrowRight, Check, MapPin, Play } from 'lucide-react'
import { HERO_DEMO, LANDING_IMAGES } from './landingDemo'

export function LandingHero() {
  const img = LANDING_IMAGES
  return (
    <section className="ld-hero" aria-labelledby="ld-hero-title">
      <div className="ld-hero-copy">
        <p className="ld-eyebrow">TABITRACE · 旅迹</p>
        <h1 id="ld-hero-title">记录每一段旅程，<br /><span>让回忆更有温度。</span></h1>
        <p className="ld-hero-sub">用地图、时间轴、照片和故事，把旅行从“去过”变成可以长期收藏、回看和分享的作品。</p>
        <div className="ld-hero-actions">
          <Link href="/register" className="ld-btn is-primary">开始记录旅行 <ArrowRight size={17} /></Link>
          <a href="#how" className="ld-btn">看看旅迹怎么用</a>
        </div>
        <p className="ld-hero-note">已经有账号？<Link href="/login">登录</Link></p>
      </div>

      <div className="ld-hero-visual" aria-hidden="true">
        <figure className="ld-hv-main">
          <img src={img.heroMain.src} alt="" fetchPriority="high" width={416} height={322} />
        </figure>
        <div className="ld-hv-place">
          <span className="ld-hv-dot"><MapPin size={14} /></span>
          <div>
            <b>{HERO_DEMO.place.name}<small> · {HERO_DEMO.place.area}</small></b>
            <em><Check size={12} /> {HERO_DEMO.place.status}</em>
            <p>{HERO_DEMO.place.note}</p>
          </div>
        </div>
        <div className="ld-hv-route">
          <svg viewBox="0 0 220 120" role="presentation">
            <path d="M18 96 C 58 20, 96 108, 130 58 S 190 30, 202 22" fill="none" stroke="#E97A33" strokeWidth="2.5" strokeDasharray="5 5" />
            {[[18, 96], [74, 58], [130, 58], [202, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 6 : 5} fill={i === 3 ? '#28231F' : '#E97A33'} stroke="#fff" strokeWidth="2" />)}
          </svg>
          <p>{HERO_DEMO.route.join(' → ')}</p>
        </div>
        <figure className="ld-hv-polaroid is-a"><img src={img.heroPhotoA.src} alt="" width={426} height={286} /></figure>
        <figure className="ld-hv-polaroid is-b"><img src={img.heroPhotoB.src} alt="" width={380} height={244} /></figure>
        <div className="ld-hv-story">
          <img src={img.storyFrame.src} alt="" width={288} height={512} />
          <span className="ld-hv-play"><Play size={14} /></span>
        </div>
      </div>
    </section>
  )
}
