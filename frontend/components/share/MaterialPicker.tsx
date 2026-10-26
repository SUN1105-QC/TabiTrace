'use client'

/**
 * 分享素材面板的公共部件（海报素材、九宫格素材共用）：
 * 面板外壳、日期选择条、按「哪天 · 哪个打卡地点」把照片分组。
 */

import type { ReactNode } from 'react'
import type { PhotoView, TimelineDay } from '@/services/tabitrace-api'
import { timeOfDay } from '@/lib/time'
import { dotDate, weekdayOf } from '@/utils/share-long'
import { scopeTimeline } from '@/utils/share-grid'

export type PhotoGroup = { key: string; title: string; photos: PhotoView[] }

/** 把范围内的照片按打卡分组；整趟旅行时，没有关联打卡的照片单独放在最后 */
export function photoGroups(photos: PhotoView[], timeline: TimelineDay[], day?: string): PhotoGroup[] {
  const days = scopeTimeline(timeline)
  const groups: PhotoGroup[] = []
  scopeTimeline(timeline, day).forEach(d => {
    const no = days.findIndex(x => x.date === d.date) + 1
    d.items.forEach(({ checkin }) => {
      const list = photos.filter(p => p.checkinId === checkin.id)
      if (list.length) groups.push({ key: `c${checkin.id}`, title: `DAY ${String(no).padStart(2, '0')} · ${timeOfDay(checkin.checkinTime)} ${checkin.placeName}`, photos: list })
    })
  })
  if (!day) {
    const known = new Set(groups.flatMap(g => g.photos.map(p => p.id)))
    const loose = photos.filter(p => !known.has(p.id))
    if (loose.length) groups.push({ key: 'loose', title: '其他照片（未关联打卡）', photos: loose })
  }
  return groups
}

/** 面板外壳：英文眉题 + 衬线标题 */
export function MaterialPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-black/[.07] bg-white/55 p-5">
      <p className="text-xs tracking-[.16em] text-vermilion">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-2xl">{title}</h2>
      {children}
    </section>
  )
}

/** 日期选择：第一个是「整趟旅行」（可自定义文案），其后是每一个有打卡的日期 */
export function DayPicker({ timeline, value, onPick, allLabel = '整趟旅行' }: { timeline: TimelineDay[]; value?: string; onPick: (day?: string) => void; allLabel?: string }) {
  return (
    <>
      <h3 className="mt-5 text-xs font-semibold text-black/70">日期</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip active={!value} onClick={() => onPick(undefined)}>{allLabel}</Chip>
        {scopeTimeline(timeline).map((d, i) => (
          <Chip key={d.date} active={value === d.date} onClick={() => onPick(d.date)}>
            DAY {String(i + 1).padStart(2, '0')} · {dotDate(d.date).slice(5)} {weekdayOf(d.date)}
          </Chip>
        ))}
      </div>
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[11px] transition ${active ? 'bg-ink text-white' : 'border border-black/10 bg-white/60 text-black/60 hover:border-black/25'}`}>
      {children}
    </button>
  )
}
