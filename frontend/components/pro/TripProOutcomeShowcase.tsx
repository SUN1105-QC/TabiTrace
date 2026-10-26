'use client'

/**
 * 成果展示：城市海报 / 九宫格 / 每日长图 / Travel Story 四个标签。
 * 左侧是旅迹用演示旅行真实生成的成果（与公共首页同一组截图，1 倍 / 高清两档），右侧是说明、要点与入口。
 * 要点里的规格（导出宽度、清晰度、时长、模板与音乐数量）全部来自方案配置；Free 的差异如实写在下方。
 */

import Link from 'next/link'
import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Check, Clapperboard, Music, Play } from 'lucide-react'
import { LANDING_IMAGES, PRODUCT_SHOTS, type ProductShot } from '@/components/landing/landingDemo'
import { shareFreeOf, shareProOf, storyDiff, type TripProPlan } from '@/utils/plan'
import type { TripView } from '@/services/tabitrace-api'

type TabKey = 'poster' | 'nine' | 'long' | 'story'
type Tab = { key: TabKey; label: string; desc: string; points: string[]; free: string; cta: string; path: string; shot: ProductShot }

const quality = (q: string) => (q === 'HD' ? '高清' : '标准清晰度')

function tabsOf(plan: TripProPlan): Tab[] {
  const sf = shareFreeOf(plan), sp = shareProOf(plan)
  const shareFree = `Free：${quality(sf.quality)}（海报宽 ${sf.posterWidth}px）${sf.watermark ? '，带「旅迹」水印' : ''}`
  const noMark = sp.watermark ? '带「旅迹」水印' : '无水印'
  const { freeM } = storyDiff(plan)
  const story = plan.storyPro, storyFree = plan.storyFree
  return [
    {
      key: 'poster', label: '城市海报', desc: '把地点、照片、旅行文字和路线，整理成一张真正值得收藏的旅行海报。',
      points: [`${quality(sp.quality)} PNG 导出（宽 ${sp.posterWidth}px）`, noMark, '自动读取真实旅行数据：路线、地点与数据', '可以自己挑选海报上的照片'],
      free: shareFree, cta: '查看我的海报', path: 'share?mode=poster', shot: PRODUCT_SHOTS.poster
    },
    {
      key: 'nine', label: '九宫格', desc: '按天挑出精选照片拼成九宫格，可以整张导出，也可以分别导出 9 张。',
      points: [`每张 ${sp.tileSize}×${sp.tileSize} ${quality(sp.quality)}`, '标准与旅行手帐两种格式', '整张或分别导出 9 张', noMark],
      free: shareFree, cta: '查看我的九宫格', path: 'share?mode=nine', shot: PRODUCT_SHOTS.grid
    },
    {
      key: 'long', label: '每日长图', desc: '按天展开整趟旅程，地点、时间、照片和文字一页看完，适合完整回顾。',
      points: [`${sp.scale} 倍${quality(sp.quality)}导出`, '整趟旅行或单独某一天', '自动按天整理打卡与照片', noMark],
      free: shareFree, cta: '查看我的每日长图', path: 'share?mode=long', shot: PRODUCT_SHOTS.long
    },
    {
      key: 'story', label: 'Travel Story', desc: '把地点、照片和旅行文字剪成一支竖屏短片，配上背景音乐，记下这一趟的节奏。',
      points: [`${story.quality.toUpperCase()}${story.watermark ? '' : ' 无水印'}`, `最长 ${Math.max(...story.durations)} 秒 · 最多 ${story.maxPhotos} 张照片`, `全部 ${plan.storyTemplates.length} 款模板与 ${plan.storyMusic.length} 首背景音乐`, '竖屏 9:16，也可以选 4:5 或横屏'],
      free: `Free：${storyFree.quality.toUpperCase()}${storyFree.watermark ? '，带水印' : ''} · 最长 ${Math.max(...storyFree.durations)} 秒 · ${freeM.length} 首基础音乐`,
      cta: '制作 Travel Story', path: 'video', shot: LANDING_IMAGES.storyFrame
    }
  ]
}

export function TripProOutcomeShowcase({ plan, trip, loggedIn }: { plan: TripProPlan; trip: TripView | null; loggedIn: boolean }) {
  const tabs = tabsOf(plan)
  const [active, setActive] = useState<TabKey>('poster')
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const tab = tabs.find(t => t.key === active) ?? tabs[0]

  // 方向键在标签之间移动（WAI-ARIA tabs）
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex(t => t.key === active)
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
    if (next === null) return
    e.preventDefault()
    const t = tabs[(next + tabs.length) % tabs.length]
    setActive(t.key)
    refs.current[t.key]?.focus()
  }

  const cta = !loggedIn
    ? <Link href="/login?next=%2Fpricing" className="pr-btn is-primary">登录后制作 <ArrowRight size={15} aria-hidden="true" /></Link>
    : !trip
      ? <Link href="/trips/new" className="pr-btn is-primary">先创建一段旅行 <ArrowRight size={15} aria-hidden="true" /></Link>
      : <Link href={`/trips/${trip.id}/${tab.path}`} className="pr-btn is-primary">{tab.cta} <ArrowRight size={15} aria-hidden="true" /></Link>

  return (
    <section className="pr-section" aria-labelledby="pr-outcome-title">
      <header className="pr-section-head">
        <p className="pr-eyebrow">OUTCOMES</p>
        <h2 id="pr-outcome-title">这一趟旅行，可以变成这些。</h2>
        <p>记录不会停在数据里，它最终会成为值得保存和分享的作品。</p>
      </header>

      <div className="pr-tabs" role="tablist" aria-label="旅行成果" onKeyDown={onKey}>
        {tabs.map(t => (
          <button key={t.key} ref={el => { refs.current[t.key] = el }} type="button" role="tab" id={`pr-tab-${t.key}`} aria-controls="pr-outcome-panel"
            aria-selected={active === t.key} tabIndex={active === t.key ? 0 : -1} className={active === t.key ? 'is-active' : ''} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pr-outcome" id="pr-outcome-panel" role="tabpanel" aria-labelledby={`pr-tab-${tab.key}`}>
        <div className={`pr-outcome-stage is-${tab.key}`}>
          {tab.key === 'story' ? (
            <div className="pr-phone">
              <img src={tab.shot.src} srcSet={tab.shot.srcSet} sizes="(max-width: 767px) 52vw, 250px" alt={tab.shot.alt} width={tab.shot.width} height={tab.shot.height} loading="lazy" decoding="async" />
              <span className="pr-phone-play" aria-hidden="true"><Play size={20} /></span>
              <span className="pr-phone-tags" aria-hidden="true">
                <i><Clapperboard size={12} />{plan.storyPro.quality.toUpperCase()}</i>
                <i>{Math.max(...plan.storyPro.durations)}s</i>
                <i><Music size={12} />{plan.storyMusic.length}</i>
              </span>
            </div>
          ) : (
            <img key={tab.key} src={tab.shot.src} srcSet={tab.shot.srcSet} sizes="(max-width: 767px) 86vw, (max-width: 1023px) 60vw, 460px" alt={tab.shot.alt} width={tab.shot.width} height={tab.shot.height} loading="lazy" decoding="async" />
          )}
        </div>
        <div className="pr-outcome-copy">
          <h3>{tab.label}</h3>
          <p className="pr-outcome-desc">{tab.desc}</p>
          <ul>{tab.points.map(pt => <li key={pt}><Check size={15} aria-hidden="true" />{pt}</li>)}</ul>
          <p className="pr-outcome-free">{tab.free}</p>
          <div className="pr-outcome-cta">{cta}</div>
          <p className="pr-outcome-sample">示例由旅迹用一段演示旅行真实生成；你的成果会用你自己的照片与记录。</p>
        </div>
      </div>
    </section>
  )
}
