'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const items = [
  ['','总览'],['/map','地图与打卡'],['/gallery','照片'],['/achievements','成就'],['/summary','总结'],['/share','分享成果'],['/video','旅行视频']
]

export function LiveTripSubnav({tripId}:{tripId:number}) {
  const pathname = usePathname()
  useEffect(()=>{localStorage.setItem('tabitrace-live-trip-id',String(tripId))},[tripId])
  return <nav className="mt-7 flex gap-2 overflow-x-auto pb-2">
    {items.map(([suffix,label])=>{
      const href=`/trips/${tripId}${suffix}`
      const active = suffix ? pathname.startsWith(href) : pathname===href
      return <Link key={suffix} href={href} className={`shrink-0 rounded-full px-4 py-2 text-xs transition ${active?'bg-ink text-white':'border border-black/10 bg-white/50 text-black/55 hover:border-vermilion/30'}`}>{label}</Link>
    })}
  </nav>
}
