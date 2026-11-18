'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { PageContainer } from '@/components/common/PageContainer'
import { RecentActivities } from '@/components/home/RecentActivities'
import { useHomeData } from '@/hooks/useHomeData'
import { hasSession } from '@/services/api'

const subscribeSession = () => () => {}
const serverSession = () => false

/** 复用已授权旅行记录生成的活动，按页展示；不创建另一套跨用户活动数据。 */
export default function ActivitiesPage() {
  const enabled = useSyncExternalStore(subscribeSession, hasSession, serverSession)
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useHomeData(enabled)
  const pages = Math.max(1, Math.ceil(data.activities.length / 20))
  const current = Math.min(page, pages)
  return <main><SiteHeader /><PageContainer variant="narrow" className="hw-workspace hw-activity-page">
    <header className="hw-heading"><div><h1>旅行活动</h1><p>当前旅行的打卡、照片、行程和视频动态，以及旅行创建记录。</p></div><Link className="hw-secondary" href="/">返回工作台</Link></header>
    {loading || !enabled ? <p role="status">正在读取活动…</p> : error ? <div role="alert"><p>{error}</p><button className="hw-secondary" onClick={reload}>重试</button></div> : <>
      {data.loadIssues.length > 0 && <p role="alert">{data.loadIssues.join('、')}读取失败，活动可能不完整。<button className="hw-secondary" onClick={reload}>重试</button></p>}
      <RecentActivities activities={data.activities.slice((current - 1) * 20, current * 20)} tripId={data.activeTrip?.id ?? null} limit={20} showAllLink={false} />
      <nav aria-label="活动分页" className="hw-activity-pagination"><button className="hw-secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>上一页</button><span>{current} / {pages}</span><button className="hw-secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>下一页</button></nav>
    </>}
  </PageContainer></main>
}
