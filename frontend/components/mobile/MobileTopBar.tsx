'use client'

/** 移动端顶部：品牌 + 通知 + 头像，下面跟一条独立搜索栏（点击打开全局搜索）。 */

import Link from 'next/link'
import { Search } from 'lucide-react'
import { NotificationCenter, type NotificationItem } from '@/components/common/NotificationCenter'
import type { UserView } from '@/services/tabitrace-api'

export function MobileTopBar({
  user, notifications, onOpenSearch
}: {
  user: UserView | null
  notifications: NotificationItem[]
  onOpenSearch: () => void
}) {
  const name = user?.nickname?.trim() || '旅行中的你'

  return (
    <header className="m-topbar">
      <div className="m-topbar-row">
        <Link href="/" className="m-brand" aria-label="旅迹 TabiTrace 首页">
          <span className="m-brand-mark">旅</span>
          <span className="m-brand-text"><b>旅迹</b><small>TabiTrace</small></span>
        </Link>
        <div className="m-topbar-actions">
          <NotificationCenter items={notifications} />
          <Link href="/profile" className="m-avatar" aria-label="个人设置">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{name.slice(0, 1)}</span>}
          </Link>
        </div>
      </div>

      <button type="button" className="m-search" onClick={onOpenSearch} aria-label="搜索地点、行程、照片或旅行">
        <Search size={18} />
        <span>搜索地点、行程、照片或旅行…</span>
        <kbd>Ctrl K</kbd>
      </button>
    </header>
  )
}
