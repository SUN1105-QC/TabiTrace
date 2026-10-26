'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { TripView } from '@/services/tabitrace-api'
import { hdImage, hdSrcSet } from '@/utils/place-images'

export function TravelMemoryBanner({ trips }: { trips: TripView[] }) {
  const past = trips.filter(t => t.status === 'COMPLETED' || t.status === 'ARCHIVED')
  const cover = past.find(t => t.coverImage)?.coverImage || hdImage('11-takeshita-street')
  return (
    <Link href="/memories" className="home-banner">
      <img src={cover} srcSet={hdSrcSet(cover)} sizes="(max-width: 1023px) 50vw, 360px" alt="旅行回忆" loading="lazy" decoding="async" />
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
      <img src={hdImage('01-sensoji-kaminarimon')} srcSet={hdSrcSet(hdImage('01-sensoji-kaminarimon'))} sizes="(max-width: 1023px) 50vw, 360px" alt="浅草寺雷门" loading="lazy" decoding="async" />
      <span className="home-banner-body">
        <b>推荐探索 <ArrowRight size={15} /></b>
        <small>发现更多值得去的地方</small>
      </span>
    </Link>
  )
}
