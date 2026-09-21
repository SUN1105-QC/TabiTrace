'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Camera, Clock3, Images, MapPin, Sparkles } from 'lucide-react'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import type { TripSummary, TripView } from '@/services/tabitrace-api'

export function TodayActions({ trip, summary }: { trip: TripView | null; summary: TripSummary | null }) {
  const router = useRouter()
  const { openQuickCheckIn } = useQuickCheckIn()
  const tripPath = (suffix: string) => (trip ? `/trips/${trip.id}${suffix}` : '/trips/new')

  const actions = [
    { icon: Camera, title: '快速拍照打卡', desc: '记录此刻的美好风景', cta: '去打卡', primary: true, run: () => openQuickCheckIn(trip?.id) },
    { icon: MapPin, title: '补记一处旅行地点', desc: trip ? `当前已记录 ${summary?.places ?? 0} 个地点` : '先创建一段旅行', cta: '去打卡', primary: false, run: () => (trip ? router.push(tripPath('/map')) : router.push('/trips/new')) },
    { icon: Images, title: '挑选几张精选照片', desc: summary ? `已精选 ${summary.readiness.featuredPhotos} 张` : '把最好的照片标为精选', cta: '去挑选', primary: false, run: () => router.push(tripPath('/gallery')) },
    { icon: Sparkles, title: '生成一次旅行成果', desc: summary?.readiness.shareReady ? '分享回忆' : '完成打卡后可生成成果', cta: '去生成', primary: false, run: () => router.push(tripPath('/share')) },
    { icon: Clock3, title: '整理今天的行程时间轴', desc: '把地点、照片、记录整理好', cta: '去查看', primary: false, run: () => router.push(tripPath('/map')) }
  ]

  return (
    <section className="side-panel">
      <div className="panel-head">
        <h3>今天可以做</h3>
        <Link href={tripPath('/summary')} className="panel-link">查看全部 <ArrowRight size={12} /></Link>
      </div>
      <ul className="today-list">
        {actions.map(a => (
          <li key={a.title}>
            <span className="today-icon"><a.icon size={15} /></span>
            <span className="today-body"><b>{a.title}</b><small>{a.desc}</small></span>
            <button type="button" onClick={a.run} className={`today-cta${a.primary ? ' primary' : ''}`}>{a.cta}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
