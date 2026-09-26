'use client'

/**
 * 首页中需要真实数据的区块：
 * - 东京官方探索：公开接口 /official-cities/TOKYO/places 与 /routes（未登录可读）
 * - Travel Story 模板名与 Free / Trip Pro 规则：公开接口 /plans/trip-pro（与 Trip Pro 页面同一份配置）
 * 接口失败时隐藏数字，只保留不含数据的说明，不写死任何数量或价格。
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Film, Play } from 'lucide-react'
import { planApi, tripApi, type OfficialRouteView, type PlaceView } from '@/services/tabitrace-api'
import { isOneTimePerTrip, planPrice, type TripProPlan } from '@/utils/plan'
import { formatCurrency } from '@/utils/currency'
import { LANDING_IMAGES } from './landingDemo'

export function useLandingPlan() {
  const [plan, setPlan] = useState<TripProPlan | null>(null)
  useEffect(() => { planApi.tripPro().then(setPlan).catch(() => setPlan(null)) }, [])
  return plan
}

export function TokyoSection() {
  const [places, setPlaces] = useState<PlaceView[] | null>(null)
  const [routes, setRoutes] = useState<OfficialRouteView[] | null>(null)
  useEffect(() => {
    tripApi.officialPlaces('TOKYO').then(setPlaces).catch(() => setPlaces([]))
    tripApi.officialRoutes('TOKYO').then(setRoutes).catch(() => setRoutes([]))
  }, [])
  // 同一张封面只展示一次（例如浅草寺与雷门共用一张图）
  const seen = new Set<string>()
  const picks = (places ?? []).filter(p => p.coverImage).sort((a, b) => (a.editorRank ?? 999) - (b.editorRank ?? 999))
    .filter(p => (seen.has(p.coverImage!) ? false : (seen.add(p.coverImage!), true))).slice(0, 6)
  const areas = new Set((places ?? []).map(p => p.area).filter(Boolean)).size

  return (
    <section className="ld-tokyo" aria-labelledby="ld-tokyo-title">
      <div className="ld-tokyo-inner">
        <header className="ld-head is-light">
          <p className="ld-eyebrow">TOKYO OFFICIAL GUIDE</p>
          <h2 id="ld-tokyo-title">从东京开始，<br />探索一座城市的另一种方式。</h2>
          <p>旅迹为东京整理了官方精选地点和专题路线。创建东京旅行时可以一键加入，边走边打卡，看着探索度一点点增加。</p>
          {places && places.length > 0 && (
            <dl className="ld-tokyo-stats">
              <div><dt>官方精选地点</dt><dd>{places.length}</dd></div>
              {areas > 0 && <div><dt>探索区域</dt><dd>{areas}</dd></div>}
              {routes && routes.length > 0 && <div><dt>专题路线</dt><dd>{routes.length}</dd></div>}
            </dl>
          )}
        </header>
        {places === null ? (
          <div className="ld-tokyo-grid" aria-busy="true" aria-label="正在读取东京官方地点">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton ld-tokyo-sk" />)}</div>
        ) : picks.length > 0 && (
          <ul className="ld-tokyo-grid">
            {picks.map(p => (
              <li key={p.id}>
                <img src={p.coverImage!} alt={`${p.name}${p.area ? `（${p.area}）` : ''}`} loading="lazy" />
                <div><b>{p.name}</b><small>{[p.area, p.tagline].filter(Boolean).join(' · ')}</small></div>
              </li>
            ))}
          </ul>
        )}
        <div className="ld-tokyo-actions">
          <Link href="/explore/tokyo" className="ld-btn is-light">探索东京 <ArrowRight size={16} /></Link>
          <Link href="/register" className="ld-btn is-ghost-light">创建东京旅行</Link>
        </div>
      </div>
    </section>
  )
}

export function TravelStorySection({ plan }: { plan: TripProPlan | null }) {
  const templates = plan?.storyTemplates ?? []
  return (
    <section className="ld-story" id="travel-story" aria-labelledby="ld-story-title">
      <div className="ld-story-phone">
        <img src={LANDING_IMAGES.storyFrame.src} alt={LANDING_IMAGES.storyFrame.alt} width={288} height={512} loading="lazy" />
        <span className="ld-story-play" aria-hidden="true"><Play size={18} /></span>
      </div>
      <div className="ld-story-copy">
        <p className="ld-eyebrow">TRAVEL STORY</p>
        <h2 id="ld-story-title">把一趟旅行，剪成一支短片。</h2>
        <p>选一个模板，从旅行照片里挑出最想留下的瞬间，旅迹会把地图、日期、地点和你写下的文字编排进竖屏视频里。</p>
        {templates.length > 0 && (
          <ul className="ld-story-tags" aria-label="视频模板">
            {templates.map(t => <li key={t.name}>{t.name}{t.plan === 'PRO' && <em>PRO</em>}</li>)}
          </ul>
        )}
        <ul className="ld-story-points">
          <li><Check size={15} aria-hidden="true" />模板、素材、风格、设置、生成，五步完成</li>
          <li><Check size={15} aria-hidden="true" />网页里实时预览，生成后下载 MP4</li>
          {plan && <li><Check size={15} aria-hidden="true" />免费旅行可以生成 {plan.storyFree.quality.toUpperCase()} 视频；Trip Pro 解锁 {plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'}与全部模板</li>}
        </ul>
        <Link href="/pricing" className="ld-btn is-light"><Film size={16} /> 了解 Travel Story</Link>
      </div>
    </section>
  )
}

export function PlanSection({ plan }: { plan: TripProPlan | null }) {
  const oneTime = plan ? isOneTimePerTrip(plan) : false
  return (
    <section className="ld-section" aria-labelledby="ld-plan-title">
      <header className="ld-head">
        <p className="ld-eyebrow">FREE & TRIP PRO</p>
        <h2 id="ld-plan-title">免费开始，需要时再为这段旅行升级</h2>
      </header>
      <div className="ld-plans">
        <article className="ld-plan">
          <h3>FREE{plan && <span>{formatCurrency(0, plan.price.currency)}</span>}</h3>
          <p>从第一段旅行开始，地图、打卡、照片、时间轴和分享成果都可以直接使用。</p>
          {plan && (
            <ul>
              <li><Check size={14} />每段旅行 {plan.freeLimits.checkinsPerTrip} 次打卡、{plan.freeLimits.photosPerTrip} 张照片</li>
              <li><Check size={14} />旅行海报 · 九宫格 · 每日长图</li>
              <li><Check size={14} />Travel Story {plan.storyFree.quality.toUpperCase()}{plan.storyFree.watermark ? '（带水印）' : ''}</li>
            </ul>
          )}
        </article>
        <article className="ld-plan is-pro">
          <h3>TRIP PRO{plan && <span>{planPrice(plan)}{oneTime && <small> / 每段旅行</small>}</span>}</h3>
          <p>当一段旅行值得好好留下，为它解锁更多记录空间和完整的 Travel Story。</p>
          {plan && (
            <ul>
              <li><Check size={14} />打卡与照片不限数量</li>
              <li><Check size={14} />Travel Story {plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'}、全部模板与音乐</li>
              {oneTime && <li><Check size={14} />一次购买，只对这段旅行生效，不会自动续费</li>}
            </ul>
          )}
          <Link href="/pricing" className="ld-btn is-primary">查看 Trip Pro <ArrowRight size={16} /></Link>
        </article>
      </div>
    </section>
  )
}
