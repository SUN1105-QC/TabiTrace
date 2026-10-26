'use client'

/**
 * 九宫格素材编辑（手机优先）：
 * - 已选条：6 个照片格的小图，顺序与成品一致；点一格选中它，再从素材里挑照片放进去；先后点两个已选格交换顺序；× 移出
 * - 日期：整趟旅行（每天精选）/ DAY 01 / DAY 02 …，横向滑动
 * - 素材列表：左图右文——地点、DAY · 时间、城市 · 区域、精选星标、加入 / 替换 / 移出
 * 没选满时其余格子自动补齐（每天的精选）；选满后再点素材进入「替换」：选择要替换的格子即可。
 * 标准九宫格 6 个照片格，旅行手帐 9 张照片卡（同一套素材选择）；手帐另有「设为主图」与排版方式。
 * 选中格、待替换照片由页面持有（预览里的方格也能点选），这里只负责展示与回调。
 */

import Link from 'next/link'
import { Crown, ImageOff, MapPin, RotateCcw, Star, X } from 'lucide-react'
import type { PhotoView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { gridMaterialGroups, gridPhotos, gridSlotCount, materialOf, materialWhen, placeIndex, scopePhotos, scopeTimeline, type GridOptions } from '@/utils/share-grid'
import { scrapCover } from '@/utils/share-scrapbook'
import { dotDate, weekdayOf } from '@/utils/share-long'
import { photoThumb } from '@/utils/photo-variants'

export type GridEditState = { activeSlot: number | null; pending: number | null }

export function NineGridEditor({ trip, timeline, photos, value, onDay, state, onSlot, onPick, onRemove, onReset, onCancel, onCover, onLayout }: {
  trip: TripView
  timeline: TimelineDay[]
  photos: PhotoView[]
  value: GridOptions
  onDay: (day?: string) => void
  state: GridEditState
  onSlot: (slot: number) => void
  onPick: (photoId: number) => void
  onRemove: (slot: number) => void
  onReset: () => void
  onCancel: () => void
  /** 旅行手帐：把一张照片设为主图 */
  onCover?: (photoId: number) => void
  /** 旅行手帐：照片卡排版方式 */
  onLayout?: (layout: 'auto' | 'order') => void
}) {
  const scrapbook = value.format === 'scrapbook'
  const SLOTS = gridSlotCount(value.format)
  const places = placeIndex(timeline)
  const scoped = scopePhotos(photos, timeline, value.day)
  const chosen = value.photoIds.filter(id => scoped.some(p => p.id === id)).slice(0, SLOTS)
  const picked = gridPhotos(photos, timeline, value, SLOTS)
  const cover = scrapbook ? scrapCover(picked, trip, value.coverPhotoId) : undefined
  const activePhoto = state.activeSlot != null ? picked[state.activeSlot] : undefined
  const groups = gridMaterialGroups(photos, timeline, trip, value.day)
  const full = chosen.length >= SLOTS
  const autoCount = Math.max(0, picked.length - chosen.length)
  const memoCount = scrapbook ? 0 : SLOTS - picked.length
  const pendingPhoto = state.pending != null ? photos.find(p => p.id === state.pending) : undefined

  const status = state.pending != null
    ? `已选满 ${SLOTS} 张：点一个格子，用这张照片替换它`
    : state.activeSlot != null
      ? `已选中第 ${state.activeSlot + 1} 格：从下方素材中选一张放进去${state.activeSlot < chosen.length ? '，或点另一个已选格交换顺序' : ''}`
      : chosen.length === 0
        ? (value.day ? '默认使用这一天的照片（精选优先），也可以手动指定每一格。' : '默认优先使用每日精选照片，也可以手动指定每一格。')
        : full ? `${SLOTS} 个照片格已选满，点素材可替换任意一格。` : `还可选择 ${SLOTS - chosen.length} 张照片，其余格子自动补齐。`

  return (
    <section className="ss-card ss-editor" id="ss-grid-editor" aria-labelledby="ss-editor-title">
      <header className="ss-card-head">
        <h2 id="ss-editor-title">九宫格素材</h2>
        <span className="ss-count" aria-live="polite"><b>{chosen.length}</b> / {SLOTS} 已选</span>
        {chosen.length > 0 && <button type="button" className="ss-text-btn" onClick={onReset}><RotateCcw size={12} /> 恢复自动</button>}
      </header>

      {/* 当前已选：顺序与成品的 6 个照片格一致 */}
      <ol className={`ss-strip${SLOTS > 6 ? ' is-wide' : ''}${state.pending != null ? ' is-choosing' : ''}`} aria-label="当前已选的照片格">
        {Array.from({ length: SLOTS }, (_, i) => {
          const photo = picked[i]
          const isChosen = i < chosen.length
          const active = state.activeSlot === i
          const m = photo ? materialOf(photo, places, trip) : null
          return (
            <li key={i} className={`ss-slot${isChosen ? ' is-chosen' : photo ? ' is-auto' : ' is-empty'}${active ? ' is-active' : ''}`}>
              <button type="button" onClick={() => onSlot(i)} aria-pressed={active}
                aria-label={`第 ${i + 1} 格：${m ? (m.placeName ?? '照片') : scrapbook ? '空位' : '地点便签'}${isChosen ? '（已选）' : photo ? '（自动补齐）' : ''}`}>
                {photo ? <img src={photoThumb(photo)} alt="" loading="lazy" decoding="async" /> : <span className="ss-slot-memo">{scrapbook ? '空位' : '便签'}</span>}
                {photo && photo === cover && <span className="ss-slot-cover" aria-label="主图"><Crown size={10} aria-hidden="true" />主图</span>}
                <em>{i + 1}</em>
                {!isChosen && photo && <small>自动</small>}
              </button>
              {isChosen && <button type="button" className="ss-slot-remove" onClick={() => onRemove(i)} aria-label={`移出第 ${i + 1} 格`}><X size={11} /></button>}
            </li>
          )
        })}
      </ol>

      <div className={`ss-status${state.pending != null || state.activeSlot != null ? ' is-editing' : ''}`}>
        {pendingPhoto && <img src={photoThumb(pendingPhoto)} alt="" />}
        <p>{status}</p>
        {(state.pending != null || state.activeSlot != null) && <button type="button" className="ss-text-btn" onClick={onCancel}>取消</button>}
      </div>

      {scrapbook && (
        <div className="ss-scrap-tools">
          {activePhoto && onCover && (
            <button type="button" className="ss-btn is-ghost ss-cover-btn" disabled={activePhoto === cover} onClick={() => onCover(activePhoto.id)}>
              <Crown size={14} aria-hidden="true" />{activePhoto === cover ? '这张已是主图' : `把第 ${state.activeSlot! + 1} 张设为主图`}
            </button>
          )}
          {onLayout && (
            <div className="ss-chips is-compact" role="radiogroup" aria-label="照片卡排版">
              <button type="button" role="radio" aria-checked={value.layout !== 'order'} className={value.layout !== 'order' ? 'is-active' : ''} onClick={() => onLayout('auto')}>自动排版 · 按横竖</button>
              <button type="button" role="radio" aria-checked={value.layout === 'order'} className={value.layout === 'order' ? 'is-active' : ''} onClick={() => onLayout('order')}>按选择顺序</button>
            </div>
          )}
        </div>
      )}

      {/* 日期筛选：横向滑动，单行 */}
      <div className="ss-chips" role="tablist" aria-label="照片范围">
        <button type="button" role="tab" aria-selected={!value.day} className={!value.day ? 'is-active' : ''} onClick={() => onDay(undefined)}>整趟旅行 · 每天精选</button>
        {scopeTimeline(timeline).map((d, i) => (
          <button key={d.date} type="button" role="tab" aria-selected={value.day === d.date} className={value.day === d.date ? 'is-active' : ''} onClick={() => onDay(d.date)}>
            DAY {String(i + 1).padStart(2, '0')} · {dotDate(d.date).slice(5)} {weekdayOf(d.date)}
          </button>
        ))}
      </div>

      {scrapbook && picked.length > 0 && picked.length < SLOTS && <p className="ss-note">{scoped.length < SLOTS ? `这个范围只有 ${scoped.length} 张照片，手帐已按 ${picked.length} 张重新排版。` : `当前 ${picked.length} 张，手帐已按 ${picked.length} 张排版；还可以再选 ${SLOTS - picked.length} 张。`}</p>}
      {memoCount > 0 && scoped.length > 0 && <p className="ss-note">这个范围只有 {scoped.length} 张照片，{memoCount} 格会用去过的地点做成便签。</p>}
      {autoCount > 0 && chosen.length > 0 && <p className="ss-note">{autoCount} 格正在自动补齐（标记「自动」），点那一格即可换成指定照片。</p>}

      {photos.length === 0 ? (
        <div className="ss-empty">
          <ImageOff size={22} aria-hidden="true" />
          <p>暂无可用照片</p>
          <small>{scrapbook ? '旅行手帐需要旅行照片，请先上传照片。' : '请先上传或精选旅行照片；没有照片时，照片格会用去过的地点做成便签。'}</small>
          <Link href={`/trips/${trip.id}/gallery`} className="ss-btn is-ghost">去上传照片</Link>
        </div>
      ) : groups.length === 0 ? (
        <div className="ss-empty"><p>这一天没有照片</p><small>{scrapbook ? '换一天，或切换到整趟旅行。' : '照片格会改为写着地点的便签，或切换到整趟旅行。'}</small></div>
      ) : (
        <div className="ss-materials">
          {groups.map(g => (
            <section key={g.key} className="ss-group" aria-label={g.title}>
              <h3>{g.title}<span>{g.items.length} 张</span></h3>
              <ul>
                {g.items.map(m => {
                  const slot = chosen.indexOf(m.photo.id)
                  const autoSlot = slot < 0 ? picked.findIndex(p => p.id === m.photo.id) : -1
                  const when = materialWhen(m)
                  const action = state.activeSlot != null ? `放入第 ${state.activeSlot + 1} 格` : slot >= 0 ? '移出' : full ? '替换' : '加入九宫格'
                  return (
                    <li key={m.photo.id} className={`ss-item${slot >= 0 ? ' is-chosen' : ''}${state.pending === m.photo.id ? ' is-pending' : ''}`}>
                      <button type="button" className="ss-item-main" onClick={() => onPick(m.photo.id)} aria-label={`${m.placeName ?? '未关联地点的照片'}：${action}`}>
                        <span className="ss-item-thumb">
                          <img src={photoThumb(m.photo)} alt="" loading="lazy" decoding="async" />
                          {slot >= 0 && <em>{slot + 1}</em>}
                          {m.featured && <Star size={12} className="ss-star" aria-label="精选" />}
                        </span>
                        <span className="ss-item-text">
                          <b>{m.placeName ?? '未关联地点'}</b>
                          {when && <small>{when}</small>}
                          {m.address && <small className="ss-item-addr"><MapPin size={11} aria-hidden="true" />{m.address}</small>}
                          {slot >= 0 ? <span className="ss-tag is-on">已加入 · 第 {slot + 1} 格</span> : autoSlot >= 0 ? <span className="ss-tag">自动补齐 · 第 {autoSlot + 1} 格</span> : null}
                        </span>
                      </button>
                      <button type="button" className={`ss-item-action${slot >= 0 && state.activeSlot == null ? ' is-remove' : ''}`} onClick={() => onPick(m.photo.id)} tabIndex={-1} aria-hidden="true">{action}</button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
