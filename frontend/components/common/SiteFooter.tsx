'use client'

import Link from 'next/link'
import { Brand } from './Brand'
import { useT } from '@/components/common/PreferencesProvider'
import type { MessageKey } from '@/i18n'

/**
 * 公共页脚：只放真实存在的页面或首页锚点。
 * 隐私政策与服务条款的正式文本尚未提供，先以“即将发布”的文字显示，不做成无法打开的链接。
 */
const GROUPS: { title: MessageKey; links: [string, MessageKey][] }[] = [
  { title: 'footer.product', links: [['/#features', 'footer.features'], ['/#outcomes', 'footer.outcomes'], ['/#travel-story', 'nav.travelStory'], ['/pricing', 'publicNav.pro']] },
  { title: 'footer.explore', links: [['/explore', 'footer.officialExplore'], ['/explore/tokyo', 'footer.tokyo']] },
  { title: 'footer.account', links: [['/register', 'footer.register'], ['/login', 'footer.login']] }
]

export function SiteFooter() {
  const t = useT()
  return (
    <footer className="ld-footer">
      <div className="ld-footer-inner">
        <div className="ld-footer-brand">
          <Brand />
          <p>{t('footer.tagline')}</p>
        </div>
        <nav className="ld-footer-nav" aria-label={t('footer.nav')}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <h2>{t(g.title)}</h2>
              <ul>{g.links.map(([href, label]) => <li key={href}><Link href={href}>{t(label)}</Link></li>)}</ul>
            </div>
          ))}
          <div>
            <h2>{t('footer.about')}</h2>
            <ul>
              <li><span>{t('footer.privacySoon')}</span></li>
              <li><span>{t('footer.termsSoon')}</span></li>
              <li><Link href="/credits">{t('footer.credits')}</Link></li>
            </ul>
          </div>
        </nav>
      </div>
      <p className="ld-footer-copy">© 2026 TabiTrace · Made for every journey.</p>
    </footer>
  )
}
