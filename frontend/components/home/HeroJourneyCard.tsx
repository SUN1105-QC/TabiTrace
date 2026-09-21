'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, MapPin, Sparkles } from 'lucide-react'
import type { TripView, UserView } from '@/services/tabitrace-api'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { greeting } from '@/lib/time'

export function HeroJourneyCard({ user, trip }: { user: UserView | null; trip: TripView | null }) {
  const { openQuickCheckIn } = useQuickCheckIn()
  const [hello, setHello] = useState('你好')
  useEffect(() => { setHello(greeting()) }, [])
  const name = user?.nickname?.trim() || '旅行中的你'
  const cover = trip?.coverImage || '/images/hero-scenery.jpg'

  return (
    <section className="home-hero">
      <img src={cover} alt={trip ? `${trip.destinationName} 旅行封面` : '旅行风景'} />
      <div className="home-hero-body">
        <p className="home-hero-kicker">MY JOURNEY</p>
        <h1>{hello}，{name} ☀</h1>
        <p className="home-hero-desc">忙碌的日子里，也别忘了记录旅途的温度。地点、时间、照片和每一句话，都会成为以后值得回看的记忆。</p>
        <div className="home-hero-actions">
          <button className="warm-button" onClick={() => openQuickCheckIn(trip?.id)}>
            <Camera size={15} /> 快速打卡 <ArrowRight size={14} />
          </button>
          <Link href={trip ? `/trips/${trip.id}/map` : '/trips/new'} className="hero-ghost-button">
            继续记录 <ArrowRight size={14} />
          </Link>
          {trip && <Link href={`/trips/${trip.id}`} className="hero-ghost-button">查看旅行详情</Link>}
        </div>
      </div>

      {trip && (
        <div className="home-hero-location">
          <MapPin size={13} /> {trip.city || trip.destinationName}
          {trip.countryCode ? ` · ${trip.countryCode}` : ''}
        </div>
      )}

      <button className="home-hero-tip" onClick={() => openQuickCheckIn(trip?.id)} aria-label="随手拍一张，记录此刻的风景">
        <Sparkles size={14} />
        <span><b>随手拍一张</b>记录此刻的风景</span>
      </button>
    </section>
  )
}
