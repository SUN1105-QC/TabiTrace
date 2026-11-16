import { BookOpen, CalendarClock, Image, MessageCircle, Upload, Users, Video, type LucideIcon } from 'lucide-react'
import type { AdminOverview as Overview } from '@/services/admin'
import { adminBytes } from '@/utils/admin-users'
import styles from './admin.module.css'

export function AdminOverview({ data, loading, error, onRetry, onMessages }: {
  data: Overview | null; loading: boolean; error: string; onRetry: () => void; onMessages: () => void
}) {
  const cards: { label: string; value?: number; note: string; icon: LucideIcon; color: string; action?: () => void }[] = [
    { label: '注册用户', value: data?.users, note: data ? `停用 ${data.disabledUsers.toLocaleString('zh-CN')} 人` : '普通注册用户', icon: Users, color: 'green' },
    { label: '有效旅程', value: data?.trips, note: data ? `7 天内到期 ${data.expiringTrips.toLocaleString('zh-CN')} 条` : '尚未到期的旅程', icon: BookOpen, color: 'blue' },
    { label: '旅行照片', value: data?.photos, note: data ? `原图约 ${adminBytes(data.photoBytes)}` : '照片与原图体积', icon: Image, color: 'amber' },
    { label: '待回复留言', value: data?.openMessages, note: '前往留言管理处理', icon: MessageCircle, color: 'purple', action: onMessages },
    { label: '视频项目', value: data?.videos, note: data ? `成片约 ${adminBytes(data.videoBytes)}` : '视频与已知成片体积', icon: Video, color: 'teal' },
    { label: '排队 / 渲染', value: data?.activeRenders, note: data && data.activeRenders === 0 ? '当前暂无任务' : '等待或正在生成的视频任务', icon: Upload, color: 'blue' },
    { label: '待清理旅程', value: data?.pendingDeletionTrips, note: '自动清理每分钟运行，失败后重试', icon: CalendarClock, color: 'amber' },
  ]
  return <section id="admin-overview" className={styles.overview} aria-label="数据概览" aria-busy={loading}>
    {error && <div className={styles.error} role="alert">概览读取失败：{error}<button className={styles.button} onClick={onRetry}>重试概览</button></div>}
    <div className={styles.statsGrid}>{cards.map(card => {
      const content = <><span className={styles.statIcon} data-color={card.color}><card.icon size={24} /></span><div><span className={styles.statLabel}>{card.label}</span><strong className={loading && !data ? styles.skeletonNumber : ''}>{card.value?.toLocaleString('zh-CN') ?? '—'}</strong><small>{card.note}</small></div></>
      return card.action ? <button key={card.label} className={`${styles.statCard} ${styles.statLink}`} onClick={card.action}>{content}</button> : <article key={card.label} className={styles.statCard}>{content}</article>
    })}</div>
  </section>
}
