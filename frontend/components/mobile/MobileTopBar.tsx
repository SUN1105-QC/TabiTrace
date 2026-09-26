'use client'

/**
 * 移动端顶部：品牌 + 通知 + 头像。
 * 默认下方跟一条搜索栏；compact（旅行详情等页面）只保留搜索图标，点开的是同一个全局搜索。
 * 手机上没有 Ctrl K，不显示快捷键提示。
 */

import Link from 'next/link'
import { Search } from 'lucide-react'
import { NotificationCenter, type NotificationItem } from '@/components/common/NotificationCenter'
import type { UserView } from '@/services/tabitrace-api'

export function MobileTopBar({
  user, notifications, onOpenSearch, compact = false
}: {
  user: UserView | null
  notifications: NotificationItem[]
  onOpenSearch: () => void
  compact?: boolean
}) {
  const name = user?.nickname?.trim() || '旅行中的你'

  return (
    <header className={`m-topbar${compact ? ' is-compact' : ''}`}>
      <div className="m-topbar-row">
        <Link href="/" className="m-brand" aria-label="旅迹 TabiTrace 首页">
          <span className="m-brand-mark">旅</span>
          <span className="m-brand-text"><b>旅迹</b><small>TabiTrace</small></span>
        </Link>
        <div className="m-topbar-actions">
          {compact && (
            <button type="button" className="icon-button" onClick={onOpenSearch} aria-label="搜索地点、行程、照片或旅行">
              <Search size={20} />
            </button>
          )}
          <NotificationCenter items={notifications} />
          <Link href="/profile" className="m-avatar" aria-label="个人设置">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{name.slice(0, 1)}</span>}
          </Link>
        </div>
      </div>

      {!compact && (
        <button type="button" className="m-search" onClick={onOpenSearch} aria-label="搜索地点、行程、照片或旅行">
          <Search size={18} />
          <span>搜索地点、行程、照片或旅行…</span>
        </button>
      )}
    </header>
  )
}
