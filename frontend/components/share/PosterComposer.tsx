'use client'

/**
 * 「海报素材」面板（只在城市海报模式出现）：
 * 1. 日期：整趟旅行，或只做某一天的海报；
 * 2. 照片：按「哪天 · 哪个打卡地点」分组，依次点选，第 1 张为主图，第 2、3 张为拍立得；
 * 3. 文字：自动 / 选一条自己发过的打卡文字 / 亲手写一句 / 不放文字。
 */

import type { ReactNode } from 'react'
import type { PhotoView, TimelineDay } from '@/services/tabitrace-api'
import { notedCheckins, scopePhotos, scopeTimeline, type PosterOptions, type QuoteChoice } from '@/utils/share-poster'
import { DayPicker, MaterialPanel, PhotoPicker, photoGroups } from './MaterialPicker'

const MAX_PHOTOS = 3
const CUSTOM_MAX = 60
const ROLE = ['主图', '拍立得 1', '拍立得 2']

export function PosterComposer({ timeline, photos, value, onChange }: {
  timeline: TimelineDay[]
  photos: PhotoView[]
  value: PosterOptions
  onChange: (next: PosterOptions) => void
}) {
  const notes = notedCheckins(scopeTimeline(timeline, value.day))

  /** 换日期时，只保留仍在新范围里的照片与文字选择 */
  function pickDay(day?: string) {
    const inScope = new Set(scopePhotos(photos, timeline, day).map(p => p.id))
    const noteIds = new Set(notedCheckins(scopeTimeline(timeline, day)).map(c => c.id))
    const quote: QuoteChoice = value.quote.mode === 'note' && !noteIds.has(value.quote.checkinId) ? { mode: 'auto' } : value.quote
    onChange({ day, photoIds: value.photoIds.filter(id => inScope.has(id)), quote })
  }

  const setQuote = (quote: QuoteChoice) => onChange({ ...value, quote })
  const customText = value.quote.mode === 'custom' ? value.quote.text : ''

  return (
    <MaterialPanel eyebrow="POSTER MATERIAL" title="海报素材">
      <DayPicker timeline={timeline} value={value.day} onPick={pickDay} />
      <PhotoPicker
        groups={photoGroups(photos, timeline, value.day)}
        selected={value.photoIds}
        max={MAX_PHOTOS}
        roleOf={i => ROLE[i]}
        hint="依次点选：第 1 张做主图，第 2、3 张做拍立得。不选时自动挑选。"
        empty="这一天没有照片，海报会用竖排城市名作主视觉，下方放大路线图。"
        onChange={photoIds => onChange({ ...value, photoIds })}
      />

      <h3 className="mt-5 text-xs font-semibold text-black/70">海报文字</h3>
      <div className="mt-2 space-y-1.5 text-[12px]">
        <QuoteOption checked={value.quote.mode === 'auto'} onSelect={() => setQuote({ mode: 'auto' })}>
          自动<span className="text-black/40"> · 取{value.day ? '当天' : ''}最完整的一句打卡文字</span>
        </QuoteOption>
        {notes.map(c => (
          <QuoteOption key={c.id} checked={value.quote.mode === 'note' && value.quote.checkinId === c.id} onSelect={() => setQuote({ mode: 'note', checkinId: c.id })}>
            <span className="line-clamp-2">「{c.note!.trim()}」<span className="text-black/40">— {c.placeName}</span></span>
          </QuoteOption>
        ))}
        <QuoteOption checked={value.quote.mode === 'custom'} onSelect={() => setQuote({ mode: 'custom', text: customText })}>
          自己写一句
        </QuoteOption>
        {value.quote.mode === 'custom' && (
          <div className="pl-6">
            <textarea
              value={customText}
              maxLength={CUSTOM_MAX}
              rows={3}
              autoFocus
              onChange={e => setQuote({ mode: 'custom', text: e.target.value })}
              placeholder="写一句想放进海报的话"
              className="w-full resize-none rounded-xl border border-black/10 bg-white/80 p-2.5 text-[12px] leading-5 outline-none focus:border-[#27362F]/40"
            />
            <p className="text-right text-[10px] text-black/35">{customText.length}/{CUSTOM_MAX}</p>
          </div>
        )}
        <QuoteOption checked={value.quote.mode === 'none'} onSelect={() => setQuote({ mode: 'none' })}>不放文字</QuoteOption>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-black/40">拍立得下方会自动带上那次打卡写下的话。</p>
    </MaterialPanel>
  )
}

function QuoteOption({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-xl px-2.5 py-2 transition ${checked ? 'bg-[#27362F]/[.06]' : 'hover:bg-black/[.03]'}`}>
      <input type="radio" checked={checked} onChange={onSelect} className="mt-0.5 accent-[#27362F]" />
      <span className="min-w-0 flex-1 leading-5">{children}</span>
    </label>
  )
}
