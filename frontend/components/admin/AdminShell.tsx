'use client'

import { useState, type ReactNode } from 'react'
import { BarChart3, ChevronDown, ClipboardList, Home, Image as ImageIcon, LogOut, Menu, MessageSquare, Mountain, RefreshCw, Settings, Users } from 'lucide-react'
import packageInfo from '../../package.json'
import { adminSections, type AdminSection } from '@/services/admin-modules'
import { isDevelopment } from '@/lib/env'
import { AdminDialog } from './AdminDialog'
import styles from './admin.module.css'

export function AdminShell({ email, tab, connected, refreshing, lastUpdated, onTab, onRefresh, onLogout, children }: {
  email: string; tab: AdminSection; connected: boolean; refreshing: boolean; lastUpdated: number | null
  onTab: (tab: AdminSection) => void; onRefresh: () => void; onLogout: () => void; children: ReactNode
}) {
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [usersOpen, setUsersOpen] = useState(true)
  const [logsOpen, setLogsOpen] = useState(tab === 'logs' || tab === 'maintenance')
  const [navigationTab,setNavigationTab] = useState(tab)
  if (navigationTab !== tab) {
    setNavigationTab(tab)
    if (['users','messages','invitations'].includes(tab)) setUsersOpen(true)
    if (tab === 'logs' || tab === 'maintenance') setLogsOpen(true)
  }
  const label = adminSections[tab]
  const navigation = <nav className={styles.sideNav} aria-label="后台导航">
    <button title="首页概览" aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => { setDrawer(false); onTab('overview') }}><Home size={18} /><span>首页概览</span></button>
    <button title="用户与互动" className={styles.navGroup} aria-expanded={usersOpen} onClick={() => setUsersOpen(open => !open)}><Users size={18} /><span>用户与互动</span><ChevronDown size={15} className={usersOpen ? styles.chevronOpen : ''} /></button>
    {usersOpen && <><button title="用户管理" className={styles.subNav} aria-current={tab === 'users' ? 'page' : undefined} onClick={() => { setDrawer(false); onTab('users') }}><Users size={17} /><span>用户管理</span></button>
    <button title="留言管理" className={styles.subNav} aria-current={tab === 'messages' ? 'page' : undefined} onClick={() => { setDrawer(false); onTab('messages') }}><MessageSquare size={17} /><span>留言管理</span></button>
    <button title="注册邀请" className={styles.subNav} aria-current={tab === 'invitations' ? 'page' : undefined} onClick={() => { setDrawer(false); onTab('invitations') }}><Users size={17} /><span>注册邀请</span></button></>}
    {([['content',ClipboardList],['media',ImageIcon],['settings',Settings]] as const).map(([section,Icon]) => <button key={section} title={adminSections[section]} aria-current={tab === section ? 'page' : undefined} onClick={() => { setDrawer(false);onTab(section) }}><Icon size={18} /><span>{adminSections[section]}</span></button>)}
    <button title="日志与维护" className={styles.navGroup} aria-expanded={logsOpen} onClick={() => setLogsOpen(open => !open)}><BarChart3 size={18} /><span>日志与维护</span><ChevronDown size={15} className={logsOpen ? styles.chevronOpen : ''} /></button>
    {logsOpen && (['logs','maintenance'] as const).map(section => <button key={section} className={styles.subNav} title={adminSections[section]} aria-current={tab === section ? 'page' : undefined} onClick={() => { setDrawer(false);onTab(section) }}><BarChart3 size={17} /><span>{adminSections[section]}</span></button>)}
  </nav>
  return (
    <div className={styles.admin} data-collapsed={collapsed}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandMark}><Mountain size={24} /></span><div><small>TABITRACE ADMIN</small><strong>旅迹管理后台</strong></div></div>
        {navigation}
        <div className={styles.sidebarFoot}><span>TabiTrace v{packageInfo.version}<br />© SUNOWS</span></div>
        <svg className={styles.mountains} viewBox="0 0 230 490" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="admin-landscape-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3f7f5" stopOpacity="0" /><stop offset=".5" stopColor="#f3f7f5" stopOpacity=".3" /><stop offset="1" stopColor="#f3f7f5" /></linearGradient><path id="admin-pine" d="M0 0 -7 12 -3 12 -10 21 -5 21 -14 31 -2 31 -2 37 2 37 2 31 14 31 5 21 10 21 3 12 7 12Z" /></defs>
          <path d="M0 145 20 134 53 111 72 116 93 131 126 104 145 96 165 115 191 125 230 111V490H0Z" fill="#dce5df" />
          <path d="M0 179 28 159 55 148 90 170 119 155 149 163 177 142 201 151 230 166V490H0Z" fill="#d2ded5" />
          <path d="M0 209 33 200 65 184 97 195 126 218 153 200 183 189 210 207 230 193V490H0Z" fill="#c8d7cc" />
          <path d="M0 257 34 224 64 231 91 249 125 240 157 263 192 239 230 229V490H0Z" fill="#bbcec1" />
          <g fill="#a8c2af" opacity=".65">{[[5,214,.8],[20,237,1.1],[39,247,.85],[54,223,1.3],[78,251,.9],[96,241,.7],[117,259,1],[140,247,.9],[162,269,1.15],[186,242,1],[210,229,1.2],[228,255,.9]].map(([x,y,scale]) => <use key={`${x}-${y}`} href="#admin-pine" transform={`translate(${x} ${y}) scale(${scale})`} />)}</g>
          <g fill="#94b49e" opacity=".65">{[[0,270,1.5],[22,293,1.15],[45,281,1.4],[67,298,1.8],[97,276,1.3],[124,294,1.55],[151,277,1.9],[181,302,1.5],[207,286,1.7],[230,313,1.3]].map(([x,y,scale]) => <use key={`${x}-${y}`} href="#admin-pine" transform={`translate(${x} ${y}) scale(${scale})`} />)}</g>
          <rect width="230" height="490" fill="url(#admin-landscape-fade)" />
        </svg>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={`${styles.iconButton} ${styles.desktopToggle}`} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}><Menu size={19} /></button>
          <button className={`${styles.iconButton} ${styles.mobileToggle}`} aria-label="打开后台导航" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={19} /></button>
          <div className={styles.breadcrumb}><button onClick={() => onTab('overview')}>首页</button><span>/</span><span>{['users','messages','invitations'].includes(tab) ? '用户与互动' : '平台管理'}</span><span>/</span><b>{label}</b></div>
          <div className={styles.topbarActions}>
            <span className={styles.adminIdentity} title={email}>唯一管理员：{email}</span>
            {isDevelopment && <div id="admin-dev-control-slot" className={styles.devControlSlot} />}
            <span className={styles.connection} data-connected={connected} title={lastUpdated ? `最后同步：${new Date(lastUpdated).toLocaleString('zh-CN')}` : '等待接口返回真实数据'}><i />{refreshing ? '同步中' : connected ? '已同步' : '未同步'}</span>
            <button className={styles.iconButton} onClick={onRefresh} disabled={refreshing} aria-label="刷新数据" title="刷新数据"><RefreshCw size={17} className={refreshing ? styles.spin : ''} /></button>
            <button className={styles.button} onClick={onLogout} aria-label="退出登录"><LogOut size={16} /><span>退出</span></button>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
      {drawer && <AdminDialog title="旅迹管理后台" onClose={() => setDrawer(false)}>{navigation}</AdminDialog>}
    </div>
  )
}
