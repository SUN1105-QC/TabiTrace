/**
 * 首页的静态内容区块。所有能力描述都对应旅迹现有功能；截图来自真实界面（见 landingDemo）。
 */

import Link from 'next/link'
import { ArrowRight, BookOpenText, Camera, Check, Film, MapPinned, Route, Share2 } from 'lucide-react'
import { LANDING_IMAGES, PRODUCT_SHOTS } from './landingDemo'

type Shot = { src: string; width: number; height: number; alt: string }
const Img = ({ shot, className }: { shot: Shot; className?: string }) => (
  <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading="lazy" decoding="async" className={className} />
)

export function Capabilities() {
  return (
    <section className="ld-section" id="features" aria-labelledby="ld-cap-title">
      <header className="ld-head">
        <p className="ld-eyebrow">FEATURES</p>
        <h2 id="ld-cap-title">一趟旅行，从这里慢慢变成回忆</h2>
        <p>不只是相册，也不只是地图收藏：地点、时间、照片和文字被放在同一段旅程里。</p>
      </header>
      <div className="ld-bento">
        <article className="ld-cell is-map">
          <div className="ld-cell-text">
            <span className="ld-icon"><MapPinned size={19} /></span>
            <h3>旅行地图</h3>
            <p>去过的地方、计划中的地点和收藏的地点，都落在同一张地图上，一眼看出今天还剩哪几站。</p>
          </div>
          <Img shot={PRODUCT_SHOTS.map} className="ld-cell-shot" />
        </article>
        <article className="ld-cell">
          <span className="ld-icon"><Route size={19} /></span>
          <h3>行程与打卡</h3>
          <p>先排好每天的行程，到了之后一键打卡，时间、位置和一句话一起留下。</p>
        </article>
        <article className="ld-cell">
          <span className="ld-icon"><Camera size={19} /></span>
          <h3>照片与时间轴</h3>
          <p>照片按拍摄时间回到当天，挑出精选，时间轴自动整理成一天一天的旅程。</p>
        </article>
        <article className="ld-cell is-share">
          <div className="ld-cell-text">
            <span className="ld-icon"><Share2 size={19} /></span>
            <h3>分享成果</h3>
            <p>旅行海报、九宫格和每日长图，用你自己的照片和记录生成。</p>
          </div>
          <Img shot={PRODUCT_SHOTS.grid} className="ld-cell-shot" />
        </article>
        <article className="ld-cell is-story">
          <div className="ld-cell-text">
            <span className="ld-icon"><Film size={19} /></span>
            <h3>Travel Story</h3>
            <p>把地图、照片和旅行文字组合成一支竖屏短片。</p>
          </div>
          <img src={LANDING_IMAGES.storyFrame.src} alt={LANDING_IMAGES.storyFrame.alt} width={288} height={512} loading="lazy" className="ld-cell-story" />
        </article>
      </div>
    </section>
  )
}

const PREVIEWS: { key: string; eyebrow: string; title: string; copy: string; points: string[]; shot: Shot }[] = [
  { key: 'map', eyebrow: 'MAP & CHECK-IN', title: '地图与打卡', copy: '地图是旅行工作台的主角。当天的计划地点按时间编号，打卡过的地点变成橙色，下一站在哪里一目了然。', points: ['按天筛选地图与行程', '到达后一键打卡，自动完成当天计划', '搜索官方地点或添加自定义地点'], shot: PRODUCT_SHOTS.map },
  { key: 'timeline', eyebrow: 'TIMELINE', title: '旅行时间轴', copy: '计划和真实打卡放在同一条时间轴上：原计划几点、实际几点到达，照片和当时写下的一句话都在旁边。', points: ['“原计划 09:30 · 09:42 已打卡”', '照片、文字与地点放在一起', '按天回看整趟旅程'], shot: PRODUCT_SHOTS.timeline },
  { key: 'gallery', eyebrow: 'GALLERY', title: '照片与精选', copy: '照片按旅行的每一天整理。把喜欢的设为精选，它们会优先出现在分享成果和 Travel Story 里。', points: ['批量上传，自动读取拍摄时间', '按天 / 精选 / 是否关联打卡整理', '设为旅行封面、批量精选'], shot: PRODUCT_SHOTS.gallery },
  { key: 'story', eyebrow: 'TRAVEL STORY', title: 'Travel Story 工作台', copy: '选模板、挑照片、定风格，右侧实时预览；确认后生成可以下载的竖屏视频。', points: ['多种模板与背景音乐', '拖动调整镜头顺序', '生成 MP4，可以下载和分享'], shot: PRODUCT_SHOTS.story }
]

export function ProductPreviews() {
  return (
    <section className="ld-section is-white" aria-labelledby="ld-preview-title">
      <header className="ld-head">
        <p className="ld-eyebrow">PRODUCT</p>
        <h2 id="ld-preview-title">旅途中怎么用</h2>
      </header>
      <div className="ld-previews">
        {PREVIEWS.map((p, i) => (
          <article key={p.key} className={`ld-preview${i % 2 ? ' is-reverse' : ''}`}>
            <div className="ld-preview-shot"><Img shot={p.shot} /></div>
            <div className="ld-preview-copy">
              <p className="ld-eyebrow">{p.eyebrow}</p>
              <h3>{p.title}</h3>
              <p>{p.copy}</p>
              <ul>{p.points.map(pt => <li key={pt}><Check size={14} aria-hidden="true" />{pt}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function JourneyFlow() {
  const steps = [
    ['创建旅行', '选好目的地、日期和同行人数，地图、时间轴和照片空间会自动准备好。'],
    ['一路记录', '在地图上安排行程，到达后打卡，顺手留下照片和一句话。'],
    ['自动整理', '打卡与照片按当地日期归入每一天，旅行地图和统计随之更新。'],
    ['生成成果', '做出旅行海报、九宫格、每日长图，再剪成一支 Travel Story。']
  ]
  return (
    <section className="ld-section is-beige" id="how" aria-labelledby="ld-how-title">
      <header className="ld-head">
        <p className="ld-eyebrow">HOW IT WORKS</p>
        <h2 id="ld-how-title">四步，把一趟旅行留下来</h2>
      </header>
      <ol className="ld-steps">
        {steps.map(([t, d], i) => (
          <li key={t}><span className="ld-step-no">{String(i + 1).padStart(2, '0')}</span><h3>{t}</h3><p>{d}</p></li>
        ))}
      </ol>
    </section>
  )
}

export function Outcomes() {
  const items = [
    { key: 'poster', title: '旅行海报', desc: '一张图讲完这趟旅行：封面照片、路线、数据和一句话。', shot: PRODUCT_SHOTS.poster },
    { key: 'grid', title: '九宫格', desc: '默认用每天的精选照片，也可以整张导出或分别导出 9 张。', shot: PRODUCT_SHOTS.grid },
    { key: 'long', title: '每日长图', desc: '按天展开的长图，适合完整回顾整段行程。', shot: PRODUCT_SHOTS.long }
  ]
  return (
    <section className="ld-section" id="outcomes" aria-labelledby="ld-out-title">
      <header className="ld-head">
        <p className="ld-eyebrow">OUTCOMES</p>
        <h2 id="ld-out-title">旅行结束后，可以得到这些</h2>
        <p>以下示例由旅迹用一段演示旅行真实生成；你的成果会用你自己的照片与记录。</p>
      </header>
      <div className="ld-outcomes">
        {items.map(it => (
          <article key={it.key} className="ld-outcome">
            <div className="ld-outcome-shot"><Img shot={it.shot} /></div>
            <h3>{it.title}</h3>
            <p>{it.desc}</p>
          </article>
        ))}
        <article className="ld-outcome is-story">
          <div className="ld-outcome-shot is-dark"><img src={LANDING_IMAGES.storyFrame.src} alt={LANDING_IMAGES.storyFrame.alt} width={288} height={512} loading="lazy" /></div>
          <h3>Travel Story</h3>
          <p>竖屏旅行短片，可以下载 MP4 分享。</p>
        </article>
      </div>
    </section>
  )
}

export function MemoriesBanner() {
  return (
    <section className="ld-memories" aria-labelledby="ld-mem-title">
      <div className="ld-memories-photos" aria-hidden="true">
        {LANDING_IMAGES.memories.map(m => <img key={m.src} src={m.src} alt="" loading="lazy" />)}
      </div>
      <div className="ld-memories-copy">
        <h2 id="ld-mem-title">旅行结束了，<br />回忆才刚刚开始。</h2>
        <p>旅行完成后，它会进入你的旅行回忆：那年今日、走过的城市、解锁的成就，都能随时回看。</p>
        <ul>
          <li><BookOpenText size={16} aria-hidden="true" />旅行回忆</li>
          <li><Share2 size={16} aria-hidden="true" />分享成果</li>
          <li><Film size={16} aria-hidden="true" />Travel Story</li>
        </ul>
        <Link href="/register" className="ld-btn is-light">开始记录旅行 <ArrowRight size={16} /></Link>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="ld-final" aria-labelledby="ld-final-title">
      <h2 id="ld-final-title">下一段旅程，<br />从记录第一步开始。</h2>
      <p>基础旅行记录免费开始，需要时再为某一段旅行升级。</p>
      <div className="ld-final-actions">
        <Link href="/register" className="ld-btn is-primary">免费开始 <ArrowRight size={17} /></Link>
        <Link href="/login" className="ld-btn">登录</Link>
      </div>
    </section>
  )
}
