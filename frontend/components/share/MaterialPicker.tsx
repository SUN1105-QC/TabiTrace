'use client'

/**
 * 分享素材面板的公共部件（海报素材、九宫格素材共用）：
 * 日期选择条、按「哪天 · 哪个打卡地点」分组的照片点选网格。
 */

import type { ReactNode } from 'react'
import { RotateCcw, Star } from 'lucide-react'
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

/**
 * 照片点选：按点选顺序记录，徽标显示该照片在成品里的角色（roleOf），选满后其余照片变灰。
 * 精选照片右下角带星标。
 */
export function PhotoPicker({ groups, selected, max, roleOf, hint, empty, onChange }: {
  groups: PhotoGroup[]
  selected: number[]
  max: number
  roleOf: (index: number) => string
  hint: ReactNode
  empty: ReactNode
  onChange: (ids: number[]) => void
}) {
  const full = selected.length >= max
  function toggle(id: number) {
    const has = selected.includes(id)
    if (!has && full) return
    onChange(has ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-black/70">照片 <span className="font-normal text-black/40">{selected.length}/{max}</span></h3>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="inline-flex items-center gap-1 text-[11px] text-black/45 hover:text-ink">
            <RotateCcw size={11} /> 恢复自动挑选
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-5 text-black/45">{hint}</p>
      {groups.length === 0 ? (
        <p className="mt-3 rounded-xl bg-black/[.03] p-3 text-[11px] leading-5 text-black/50">{empty}</p>
      ) : (
        <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
          {groups.map(g => (
            <div key={g.key}>
              <p className="truncate text-[11px] text-black/50">{g.title}</p>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {g.photos.map(p => {
                  const order = selected.indexOf(p.id)
                  const isOn = order >= 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      disabled={!isOn && full}
                      aria-pressed={isOn}
                      title={isOn ? `${roleOf(order)}（再点一次取消）` : p.featured ? '精选照片' : '选用这张照片'}
                      className={`relative aspect-square overflow-hidden rounded-lg bg-black/5 transition ${isOn ? 'ring-2 ring-[#27362F] ring-offset-1' : 'hover:opacity-90'} ${!isOn && full ? 'opacity-35' : ''}`}
                    >
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      {isOn && <span className="absolute left-1 top-1 rounded-full bg-[#27362F] px-1.5 py-0.5 text-[9px] text-white">{roleOf(order)}</span>}
                      {p.featured && <Star size={11} className="absolute bottom-1 right-1 fill-[#F2B84B] text-[#F2B84B] drop-shadow" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
