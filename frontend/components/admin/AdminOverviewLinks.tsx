'use client'

import { ArrowRight, ClipboardList, Image as ImageIcon, Settings, Users, BarChart3, RefreshCw } from 'lucide-react'
import { adminSections, type AdminSection } from '@/services/admin-modules'
import styles from './admin.module.css'

/** 概览入口复用当前管理员的数据与导航保护，不通过普通用户工作区访问后台资源。 */
export function AdminOverviewLinks({ onTab }: { onTab: (section: AdminSection) => void }) {
  const entries = [
    ['users', Users, '查找账号，管理权限、配额与使用状态'],
    ['content', ClipboardList, '查看旅程、归档状态与公开分享'],
    ['media', ImageIcon, '管理照片、视频及用户上传的音乐'],
    ['settings', Settings, '调整新账号默认权限，查看运行配置'],
    ['logs', BarChart3, '追溯管理操作与执行结果'],
    ['maintenance', RefreshCw, '检查待清理数据与后台维护任务'],
  ] as const
  return <section className={styles.overviewLinks} aria-label="后台快捷入口">{entries.map(([section, Icon, description]) => <button key={section} onClick={() => onTab(section)}><Icon size={23} /><span><strong>{adminSections[section]}</strong><small>{description}</small></span><ArrowRight size={17} /></button>)}</section>
}
