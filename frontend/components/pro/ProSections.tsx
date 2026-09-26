'use client'

/** Trip Pro 升级中心的内容区块：价值、成果预览、价格、为什么按旅行、对比、FAQ。数据全部来自方案配置。 */

import Link from 'next/link'
import { BookOpenText, Camera, Check, Film, MapPinned, Play } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'
import { isOneTimePerTrip, planComparison, planFaq, planPrice, planValues, type TripProPlan } from '@/utils/plan'

const VALUE_ICON = { record: MapPinned, share: Camera, story: Film, review: BookOpenText } as const

export function ProValues({ plan }: { plan: TripProPlan }) {
  return (
    <section className="pr-section" aria-labelledby="pr-values-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">WHAT YOU GET</p>
        <h2 id="pr-values-title">升级后，这趟旅行多了什么</h2>
      </header>
      <div className="pr-values">
        {planValues(plan).map(v => {
          const Icon = VALUE_ICON[v.key as keyof typeof VALUE_ICON] ?? Check
          return (
            <article key={v.key} className="pr-value">
              <span className="pr-value-icon"><Icon size={20} aria-hidden="true" /></span>
              <h3>{v.title}</h3>
              <p>{v.lead}</p>
              <ul>{v.points.map(pt => <li key={pt}><Check size={13} aria-hidden="true" />{pt}</li>)}</ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/** 成果预览：用项目自带的城市图片示意版式，不展示任何用户内容；并如实标注 Free 是否可用 */
const IMG = ['/images/explore/asakusa.jpg', '/images/explore/ueno-autumn.jpg', '/images/explore/tokyo-station.jpg', '/images/explore/ginza.jpg', '/images/explore/nakamise.jpg', '/images/explore/rainbow-bridge.jpg', '/images/explore/shibuya-night.jpg', '/images/explore/ueno-panda.jpg', '/images/explore/tocho-night.jpg']

export function ProPreviews({ plan, trip }: { plan: TripProPlan; trip: TripView | null }) {
  const base = trip ? `/trips/${trip.id}` : null
  const items = [
    { key: 'poster', title: '旅行海报', note: 'Free 与 Pro 都可以制作', href: base && `${base}/share`, art: <div className="pr-art pr-art-poster"><img src={IMG[0]} alt="" loading="lazy" /><span /><i /><i /></div> },
    { key: 'grid', title: '九宫格', note: 'Free 与 Pro 都可以制作', href: base && `${base}/share`, art: <div className="pr-art pr-art-grid">{IMG.map(s => <img key={s} src={s} alt="" loading="lazy" />)}</div> },
    { key: 'long', title: '每日长图', note: 'Free 与 Pro 都可以制作', href: base && `${base}/share`, art: <div className="pr-art pr-art-long"><img src={IMG[1]} alt="" loading="lazy" /><i /><img src={IMG[3]} alt="" loading="lazy" /><i /><img src={IMG[5]} alt="" loading="lazy" /></div> },
    { key: 'story', title: 'Travel Story', note: `Pro：${plan.storyPro.quality.toUpperCase()}${plan.storyPro.watermark ? '' : ' 无水印'} · 最长 ${Math.max(...plan.storyPro.durations)} 秒`, pro: true, href: base && `${base}/video`, art: <div className="pr-art pr-art-story"><img src={IMG[6]} alt="" loading="lazy" /><span><Play size={18} /></span></div> }
  ]
  return (
    <section className="pr-section" aria-labelledby="pr-preview-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">OUTCOMES</p>
        <h2 id="pr-preview-title">这趟旅行可以变成这些</h2>
        <p>示意图使用旅迹自带的城市照片；在你的旅行里制作时，用的是你自己的照片与记录。</p>
      </header>
      <div className="pr-previews">
        {items.map(it => (
          <article key={it.key} className={`pr-preview${it.pro ? ' is-pro' : ''}`}>
            {it.art}
            <div className="pr-preview-text">
              <h3>{it.title}{it.pro && <em>PRO 更完整</em>}</h3>
              <p>{it.note}</p>
              {it.href && <Link href={it.href}>在这趟旅行里制作</Link>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ProPricing({ plan, cta }: { plan: TripProPlan; cta: React.ReactNode }) {
  const price = planPrice(plan)
  const oneTime = isOneTimePerTrip(plan)
  const f = plan.freeLimits
  return (
    <section className="pr-section" aria-labelledby="pr-price-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">PRICING</p>
        <h2 id="pr-price-title">基础记录永久免费，需要时再升级</h2>
      </header>
      <div className="pr-pricing">
        <article className="pr-plan is-free">
          <h3>FREE</h3>
          <p className="pr-plan-price">{formatCurrency(0, plan.price.currency)}</p>
          <ul>
            <li><Check size={14} />每段旅行 {f.checkinsPerTrip} 次打卡、{f.photosPerTrip} 张照片</li>
            <li><Check size={14} />旅行海报 · 九宫格 · 每日长图</li>
            <li><Check size={14} />Travel Story {plan.storyFree.quality.toUpperCase()}{plan.storyFree.watermark ? '（带水印）' : ''}</li>
            <li><Check size={14} />同时可以进行 {f.activeFreeTrips} 段免费旅行</li>
          </ul>
        </article>
        <article className="pr-plan is-pro">
          <p className="pr-plan-tag">TRIP PRO</p>
          <p className="pr-plan-price">{price}<small>{oneTime ? ' / 每段旅行 · 一次性' : ''}</small></p>
          <dl className="pr-plan-terms">
            <div><dt>生效范围</dt><dd>只对你选择升级的这一段旅行{oneTime ? '，永久有效' : ''}</dd></div>
            {oneTime && <div><dt>续费</dt><dd>不是订阅，不会自动续费</dd></div>}
          </dl>
          <ul>
            <li><Check size={14} />打卡与照片不限数量</li>
            <li><Check size={14} />Travel Story {plan.storyPro.quality.toUpperCase()}{plan.storyPro.watermark ? '' : ' 无水印'} · 最长 {Math.max(...plan.storyPro.durations)} 秒</li>
            <li><Check size={14} />全部视频模板与背景音乐</li>
            <li><Check size={14} />每个视频最多 {plan.storyPro.maxPhotos} 张照片</li>
          </ul>
          {cta}
        </article>
      </div>
    </section>
  )
}

export function WhyPerTrip({ plan }: { plan: TripProPlan }) {
  if (!isOneTimePerTrip(plan)) return null
  return (
    <section className="pr-why" aria-labelledby="pr-why-title">
      <h2 id="pr-why-title">为什么按旅行购买</h2>
      <ul>
        <li><b>不需要长期订阅</b><span>只在某一趟旅行值得好好留下时付费，平时不会产生任何费用。</span></li>
        <li><b>新旅行仍然免费开始</b><span>每段新旅行都从免费版开始，先记录，再决定要不要升级。</span></li>
        <li><b>只有升级的旅行收费</b><span>{planPrice(plan)} 只解锁你选择的那一段旅行，其他旅行不受影响。</span></li>
      </ul>
    </section>
  )
}

export function ProComparison({ plan }: { plan: TripProPlan }) {
  const rows = planComparison(plan)
  const groups = [...new Set(rows.map(r => r.group))]
  return (
    <section className="pr-section" aria-labelledby="pr-compare-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">COMPARE</p>
        <h2 id="pr-compare-title">Free 与 Trip Pro 对比</h2>
      </header>
      <table className="pr-table">
        <thead><tr><th scope="col">功能</th><th scope="col">FREE</th><th scope="col">TRIP PRO</th></tr></thead>
        <tbody>
          {groups.map(g => [
            <tr key={`g-${g}`} className="pr-table-group"><th colSpan={3} scope="colgroup">{g}</th></tr>,
            ...rows.filter(r => r.group === g).map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.free}</td><td className="is-pro">{r.pro}</td></tr>)
          ])}
        </tbody>
      </table>
      <div className="pr-compare-cards">
        {groups.map(g => (
          <div key={g} className="pr-compare-card">
            <h3>{g}</h3>
            {rows.filter(r => r.group === g).map(r => (
              <dl key={r.label}>
                <dt>{r.label}</dt>
                <dd><span>FREE</span>{r.free}</dd>
                <dd className="is-pro"><span>PRO</span>{r.pro}</dd>
              </dl>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function ProFaq({ plan }: { plan: TripProPlan }) {
  return (
    <section className="pr-section" aria-labelledby="pr-faq-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">FAQ</p>
        <h2 id="pr-faq-title">常见问题</h2>
      </header>
      <div className="pr-faq">
        {planFaq(plan).map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
