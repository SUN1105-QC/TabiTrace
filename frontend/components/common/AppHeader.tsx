'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, LogOut, Menu, Search, Settings, UserRound } from 'lucide-react'
import { authApi, type UserView } from '@/services/tabitrace-api'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { NotificationCenter, type NotificationItem } from './NotificationCenter'
import { greeting } from '@/lib/time'

export function AppHeader({
  title, user, notifications, activeTripId, onOpenSearch, onOpenMenu, showTitle = true
}: {
  title: string
  user: UserView | null
  notifications: NotificationItem[]
  activeTripId: number | null
  onOpenSearch: () => void
  onOpenMenu: () => void
  showTitle?: boolean
}) {
  const router = useRouter()
  const { openQuickCheckIn } = useQuickCheckIn()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hello, setHello] = useState('你好')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setHello(greeting()) }, [])
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const name = user?.nickname?.trim() || '旅行中的你'

  async function logout() {
    setMenuOpen(false)
    try { await authApi.logout() } catch { /* 忽略：本地 token 已清理 */ }
    localStorage.removeItem('tabitrace-live-trip-id')
    router.replace('/login')
  }

  return (
    <header className="workspace-topbar">
      <div className="topbar-left">
        <button className="icon-button topbar-menu" onClick={onOpenMenu} aria-label="打开导航"><Menu size={18} /></button>
        {showTitle && <div className="workspace-title"><small>TABITRACE · TRAVEL MEMORY WORKSPACE</small><strong>{title}</strong></div>}
      </div>

      <button type="button" className="workspace-search" onClick={onOpenSearch} aria-label="搜索地点、行程、照片或旅行">
        <Search size={16} />
        <span className="flex-1 text-left">搜索地点、行程、照片或旅行…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="workspace-actions">
        <NotificationCenter items={notifications} />
        <button className="warm-button quick-checkin" onClick={() => openQuickCheckIn(activeTripId ?? undefined)}>
          <Camera size={15} /> <span>快速打卡</span>
        </button>
        <div className="relative" ref={menuRef}>
          <button className="user-chip" onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
            {user?.avatarUrl
              ? <img className="user-avatar" src={user.avatarUrl} alt="" />
              : <span className="user-avatar">{name.slice(0, 1)}</span>}
            <span className="user-hello">{hello}，{name}</span>
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="popover popover-sm" role="menu">
              <div className="popover-head"><b>{name}</b><span>{user?.email || ''}</span></div>
              <div className="popover-list">
                <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span className="popover-icon"><UserRound size={15} /></span><span className="flex-1"><b>个人主页</b></span>
                </Link>
                <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span className="popover-icon"><Settings size={15} /></span><span className="flex-1"><b>账户设置</b></span>
                </Link>
                <button role="menuitem" onClick={logout}>
                  <span className="popover-icon warn"><LogOut size={15} /></span><span className="flex-1 text-left"><b>退出登录</b></span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
