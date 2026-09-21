'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'

export function TravelMemoryBanner({ trips }: { trips: TripView[] }) {
  const past = trips.filter(t => t.status === 'COMPLETED' || t.status === 'ARCHIVED')
  const cover = past.find(t => t.coverImage)?.coverImage || '/images/harajuku.jpg'
  return (
    <Link href="/memories" className="home-banner">
      <img src={cover} alt="旅行回忆" loading="lazy" />
      <span className="home-banner-body">
        <b>旅行回忆 <ArrowRight size={15} /></b>
        <small>{past.length ? `${past.length} 段旅行已经成为回忆，` : '那些走过的路，'}<br />都会成为更好的自己。</small>
      </span>
    </Link>
  )
}

export function ExploreBanner() {
  return (
    <Link href="/explore/tokyo" className="home-banner explore">
      <img src="/images/asakusa.jpg" alt="推荐探索" loading="lazy" />
      <span className="home-banner-body">
        <b>推荐探索 <ArrowRight size={15} /></b>
        <small>发现更多值得去的地方</small>
      </span>
    </Link>
  )
}
