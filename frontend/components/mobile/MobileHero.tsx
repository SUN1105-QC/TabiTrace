'use client'

/** 移动端 Hero：问候语 + 说明 + 快速打卡 / 添加记录，右下角显示当前旅行城市。 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, MapPin, Plus } from 'lucide-react'
import type { TripView, UserView } from '@/services/tabitrace-api'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'
import { greeting } from '@/lib/time'

export function MobileHero({ user, trip }: { user: UserView | null; trip: TripView | null }) {
  const { openQuickCheckIn } = useQuickCheckIn()
  const [hello, setHello] = useState('你好')
  useEffect(() => { setHello(greeting()) }, [])

  const name = user?.nickname?.trim() || '旅行中的你'
  const cover = trip?.coverImage || '/images/hero-scenery.jpg'
  const city = trip?.city || trip?.destinationName || ''

  return (
    <section className="m-hero">
      <img src={cover} alt={trip ? `${trip.destinationName} 旅行封面` : '旅行风景'} />

      {city && (
        <span className="m-hero-script" aria-hidden="true">
          <b>{city}</b>
          <i>More than<br />a trip</i>
        </span>
      )}

      <div className="m-hero-body">
        <p className="m-hero-kicker">MY JOURNEY</p>
        <h1>{hello}，<br />{name} <span aria-hidden="true">☀</span></h1>
        <p className="m-hero-desc">
          忙碌的日子里，也别忘了记录旅途的温暖。<br />
          地点、时间、照片和每一句话，<br />
          都会成为日后值得回看的回忆。
        </p>
        <div className="m-hero-actions">
          <button type="button" className="m-btn-primary" onClick={() => openQuickCheckIn(trip?.id)}>
            <Camera size={17} /> 快速打卡 <ArrowRight size={15} />
          </button>
          <Link className="m-btn-ghost" href={trip ? `/trips/${trip.id}/map` : '/trips/new'}>
            <Plus size={16} /> 添加记录
          </Link>
        </div>
      </div>

      {city && (
        <span className="m-hero-place">
          <MapPin size={12} /> {city}{trip?.countryCode ? ` · ${trip.countryCode}` : ''}
        </span>
      )}
    </section>
  )
}
