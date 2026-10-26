'use client'

/**
 * 海报素材面板的各个选择器：日期范围、海报标题、主照片 / 辅助照片、海报文字。
 * 手机优先：可点区域 ≥ 40px，照片网格不会撑出横向滚动。
 */

import { useState, type ReactNode } from 'react'
import { RotateCcw, Star } from 'lucide-react'
import type { PhotoView, TimelineDay } from '@/services/tabitrace-api'
import { scopeTimeline } from '@/utils/share-grid'
import { photoThumb } from '@/utils/photo-variants'
import { POSTER_QUOTE_MAX, POSTER_SECONDARY_MAX, POSTER_TITLE_MAX, notedCheckins, type QuoteChoice } from '@/utils/poster-data'
import { DayPicker, photoGroups } from '../MaterialPicker'

function Head({ title, extra, action }: { title: string; extra?: ReactNode; action?: ReactNode }) {
  return (
    <div className="cp-panel-head">
      <h3>{title}{extra && <span>{extra}</span>}</h3>
      {action}
    </div>
  )
}

function ResetButton({ onClick, children = '恢复自动' }: { onClick: () => void; children?: ReactNode }) {
  return <button type="button" className="cp-panel-reset" onClick={onClick}><RotateCcw size={11} aria-hidden="true" />{children}</button>
}

// ---------------------------------------------------------------- 日期

export function PosterDateSelector({ timeline, value, onPick }: { timeline: TimelineDay[]; value?: string; onPick: (day?: string) => void }) {
  return (
    <div className="cp-panel-block">
      <DayPicker timeline={timeline} value={value} onPick={onPick} />
      <p className="cp-panel-hint">选某一天时，海报的照片、文字、统计与路线都只用当天的数据。</p>
    </div>
  )
}

// ---------------------------------------------------------------- 标题

export function PosterTitleEditor({ fallback, value, onChange }: { fallback: string; value?: string; onChange: (title?: string) => void }) {
  const text = value ?? ''
  return (
    <div className="cp-panel-block">
      <Head title="海报标题" extra={`${Array.from(text).length}/${POSTER_TITLE_MAX}`} action={value != null && <ResetButton onClick={() => onChange(undefined)}>用旅行标题</ResetButton>} />
      <input
        className="cp-panel-input"
        value={text}
        maxLength={POSTER_TITLE_MAX}
        placeholder={fallback}
        aria-label="海报标题"
        onChange={e => onChange(e.target.value.trim() ? e.target.value : undefined)}
      />
      <p className="cp-panel-hint">不填时使用旅行标题；标题含城市名时会在城市名前分成两行。</p>
    </div>
  )
}

// ---------------------------------------------------------------- 照片

/**
 * 主照片（单选）/ 辅助照片（最多 2 张，做底部拍立得）。
 * 「自动」角标表示当前海报自动挑中的照片；blocked 是另一个角色已经用到的照片（不能同时既是主图又是拍立得）。
 */
export function PosterPhotoSelector({ mode, photos, timeline, day, selected, autoIds, blocked, onChange }: {
  mode: 'main' | 'secondary'
  photos: PhotoView[]
  timeline: TimelineDay[]
  day?: string
  selected: number[]
  autoIds: number[]
  blocked: number[]
  onChange: (ids: number[]) => void
}) {
  const [notice, setNotice] = useState('')
  const groups = photoGroups(photos, timeline, day)
  const max = mode === 'main' ? 1 : POSTER_SECONDARY_MAX
  const label = mode === 'main' ? '主照片' : '辅助照片'

  function toggle(id: number) {
    setNotice('')
    if (selected.includes(id)) { onChange(selected.filter(x => x !== id)); return }
    if (mode === 'main') { onChange([id]); return }
    if (selected.length >= max) { setNotice(`辅助照片最多 ${max} 张，先取消一张再选。`); return }
    onChange([...selected, id])
  }

  return (
    <div className="cp-panel-block">
      <Head title={label} extra={mode === 'secondary' ? `${selected.length}/${max}` : selected.length ? '已指定' : '自动'}
        action={selected.length > 0 && <ResetButton onClick={() => { setNotice(''); onChange([]) }} />} />
      <p className="cp-panel-hint">{mode === 'main' ? '海报右上的大照片。不指定时优先用精选照片。' : '底部的拍立得，最多 2 张。不指定时自动挑不同日期、不同地点的照片。'}</p>
      {notice && <p className="cp-panel-notice" role="status">{notice}</p>}
      {groups.length === 0 ? (
        <p className="cp-panel-empty">{day ? '这一天没有照片。' : '这趟旅行还没有照片。'}</p>
      ) : (
        <div className="cp-photo-groups">
          {groups.map(g => (
            <div key={g.key}>
              <p className="cp-photo-group-title">{g.title}</p>
              <div className="cp-photo-grid" role="group" aria-label={`${label} · ${g.title}`}>
                {g.photos.map(p => {
                  const on = selected.includes(p.id)
                  const isAuto = !on && !selected.length && autoIds.includes(p.id)
                  const isBlocked = blocked.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => toggle(p.id)} disabled={isBlocked && !on} aria-pressed={on}
                      aria-label={`${on ? '取消' : '选为'}${label}${p.featured ? '（精选）' : ''}${isBlocked ? '（已用作另一张）' : ''}`}
                      className={`cp-photo${on ? ' is-on' : ''}${isAuto ? ' is-auto' : ''}${isBlocked && !on ? ' is-blocked' : ''}`}>
                      <img src={photoThumb(p)} alt="" loading="lazy" decoding="async" />
                      {on && <span className="cp-photo-badge">{mode === 'main' ? '主图' : `拍立得 ${selected.indexOf(p.id) + 1}`}</span>}
                      {isAuto && <span className="cp-photo-badge is-auto">自动</span>}
                      {isBlocked && !on && <span className="cp-photo-badge is-muted">{mode === 'main' ? '拍立得' : '主图'}</span>}
                      {p.featured && <Star size={11} className="cp-photo-star" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 文字

export function PosterQuoteSelector({ timeline, day, value, onChange }: { timeline: TimelineDay[]; day?: string; value: QuoteChoice; onChange: (q: QuoteChoice) => void }) {
  const notes = notedCheckins(scopeTimeline(timeline, day))
  const custom = value.mode === 'custom' ? value.text : ''
  return (
    <div className="cp-panel-block">
      <Head title="海报文字" />
      <div className="cp-quote-options" role="radiogroup" aria-label="海报文字">
        <QuoteOption checked={value.mode === 'auto'} onSelect={() => onChange({ mode: 'auto' })}>
          自动<small> · 优先精选照片那次打卡写下的话，{POSTER_QUOTE_MAX} 字以内</small>
        </QuoteOption>
        {notes.map(c => (
          <QuoteOption key={c.id} checked={value.mode === 'note' && value.checkinId === c.id} onSelect={() => onChange({ mode: 'note', checkinId: c.id })}>
            <span className="cp-quote-text">「{c.note!.trim()}」<small>— {c.placeName}</small></span>
          </QuoteOption>
        ))}
        <QuoteOption checked={value.mode === 'custom'} onSelect={() => onChange({ mode: 'custom', text: custom })}>自己写一句</QuoteOption>
        {value.mode === 'custom' && (
          <div className="cp-quote-custom">
            <textarea value={custom} maxLength={POSTER_QUOTE_MAX} rows={2} autoFocus aria-label="自己写一句"
              onChange={e => onChange({ mode: 'custom', text: e.target.value })} placeholder="写一句想放进海报的话" />
            <small>{Array.from(custom).length}/{POSTER_QUOTE_MAX}</small>
          </div>
        )}
        <QuoteOption checked={value.mode === 'none'} onSelect={() => onChange({ mode: 'none' })}>不放文字</QuoteOption>
      </div>
      <p className="cp-panel-hint">超过 {POSTER_QUOTE_MAX} 字的打卡文字会自动截断；拍立得下方会带上那次打卡写下的话。</p>
    </div>
  )
}

function QuoteOption({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <label className={`cp-quote-option${checked ? ' is-on' : ''}`}>
      <input type="radio" checked={checked} onChange={onSelect} />
      <span>{children}</span>
    </label>
  )
}
