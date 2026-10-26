'use client'

/**
 * 移动端顶部：品牌 + 通知 + 头像，吸顶固定（高度写在 CSS 变量 --topbar，其他吸顶元素与锚点跳转据此让位）。
 * 默认下方跟一条搜索栏（不吸顶）；compact（旅行详情等页面）只保留搜索图标，点开的是同一个全局搜索。
 * 手机上没有 Ctrl K，不显示快捷键提示。
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { NotificationCenter, type NotificationItem } from '@/components/common/NotificationCenter'
import { BrandLogo } from '@/components/common/Brand'
import type { UserView } from '@/services/tabitrace-api'
import { avatarImage } from '@/utils/avatar'
import { useT } from '@/components/common/PreferencesProvider'

export function MobileTopBar({
  user, notifications, onOpenSearch, compact = false
}: {
  user: UserView | null
  notifications: NotificationItem[]
  onOpenSearch: () => void
  compact?: boolean
}) {
  const t = useT()
  const name = user?.nickname?.trim() || t('common.travelerFallback')
  const avatar = avatarImage(user)
  // 顶栏吸顶：页面滚动后加上底边线与阴影，和下面的内容分开
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
    <header className={`m-topbar${compact ? ' is-compact' : ''}${stuck ? ' is-stuck' : ''}`}>
      <div className="m-topbar-row">
        <Link href="/" className="m-brand" aria-label={t('nav.brandHome')}>
          <BrandLogo height={48} className="m-brand-logo" />
        </Link>
        <div className="m-topbar-actions">
          {compact && (
            <button type="button" className="icon-button" onClick={onOpenSearch} aria-label={t('header.searchLabel')}>
              <Search size={20} />
            </button>
          )}
          <NotificationCenter items={notifications} />
          <Link href="/profile" className="m-avatar" aria-label={t('nav.settings')}>
            {avatar ? <img src={avatar.src} srcSet={avatar.srcSet} sizes="46px" alt="" /> : <span>{name.slice(0, 1)}</span>}
          </Link>
        </div>
      </div>
    </header>

    {/* 搜索栏不跟随吸顶（否则固定区域太高），放在顶栏之后随页面滚走 */}
    {!compact && (
      <search className="m-search-row">
        <button type="button" className="m-search" onClick={onOpenSearch} aria-label={t('header.searchLabel')}>
          <Search size={18} />
          <span>{t('header.searchPlaceholder')}</span>
        </button>
      </search>
    )}
    </>
  )
}
