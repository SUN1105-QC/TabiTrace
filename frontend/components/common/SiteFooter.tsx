import Link from 'next/link'
import { Brand } from './Brand'

/**
 * 公共页脚：只放真实存在的页面或首页锚点。
 * 隐私政策与服务条款的正式文本尚未提供，先以“即将发布”的文字显示，不做成无法打开的链接。
 */
const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: '产品', links: [['/#features', '功能'], ['/#outcomes', '旅行成果'], ['/#travel-story', 'Travel Story'], ['/pricing', 'Trip Pro']] },
  { title: '探索', links: [['/explore', '官方探索'], ['/explore/tokyo', '东京精选']] },
  { title: '账户', links: [['/register', '免费注册'], ['/login', '登录']] }
]

export function SiteFooter() {
  return (
    <footer className="ld-footer">
      <div className="ld-footer-inner">
        <div className="ld-footer-brand">
          <Brand />
          <p>记录全球旅行，收藏地点、照片与故事，让每一次出发都留下可以回看的作品。</p>
        </div>
        <nav className="ld-footer-nav" aria-label="页脚导航">
          {GROUPS.map(g => (
            <div key={g.title}>
              <h2>{g.title}</h2>
              <ul>{g.links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
            </div>
          ))}
          <div>
            <h2>关于</h2>
            <ul>
              <li><span>隐私政策（即将发布）</span></li>
              <li><span>服务条款（即将发布）</span></li>
            </ul>
          </div>
        </nav>
      </div>
      <p className="ld-footer-copy">© 2026 TabiTrace · Made for every journey.</p>
    </footer>
  )
}
