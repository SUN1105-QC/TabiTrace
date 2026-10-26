'use client'

/**
 * Travel Gallery · 旅行照片工作台：看照片 → 按天 / 类型整理 → 挑精选 → 用于分享成果与 Travel Story。
 * “精选”就是照片的 featured 字段：分享成果（海报 / 九宫格 / 长图 / 公开分享页）与 Travel Story 自动选图都优先读取它，
 * 这里不再维护第二套选择状态。视图、筛选、排序记在地址栏（?view=&filter=&sort=）。
 *
 * 照片按页从服务端读取（游标分页，每页 48 张，滚动到底自动加载下一页），筛选 / 排序在服务端完成，
 * 统计数字（全部 / 精选 / 已关联 / 未关联）也来自服务端；网格里只加载缩略图。
 */

import { PageContainer } from '@/components/common/PageContainer'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckSquare, ImagePlus, Plus, RefreshCcw, Star, StarOff, Trash2, TriangleAlert, X } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PhotoCard, PhotoGridSkeleton } from '@/components/gallery/PhotoCard'
import { PhotoDetail } from '@/components/gallery/PhotoDetail'
import { UploadDialog } from '@/components/gallery/UploadDialog'
import { hasSession } from '@/services/api'
import { tripApi, userApi, type CheckinView, type PhotoCounts, type PhotoView, type TripView } from '@/services/tabitrace-api'
import { tripDays } from '@/utils/travel-map'
import { buildItems, filterItems, groupByDay, sortItems, type GalleryFilter, type GalleryItem, type GallerySort, type GalleryView } from '@/utils/gallery'
import { isCoverPhoto } from '@/utils/photo-variants'
import { useQuickCheckIn } from '@/components/checkin/QuickCheckInProvider'

/** 每页 48 张：网格 2 / 3 / 4 列都能排满整行 */
const PAGE = 48
const FILTERS: [GalleryFilter, string][] = [['ALL', '全部'], ['FEATURED', '精选'], ['LINKED', '已关联打卡'], ['UNLINKED', '未关联']]

export default function GalleryPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const [trip, setTrip] = useState<TripView | null>(null)
  const [photos, setPhotos] = useState<PhotoView[]>([])
  const [checkins, setCheckins] = useState<CheckinView[]>([])
  const [timeZone, setTimeZone] = useState('Asia/Tokyo')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState<GalleryView>('day')
  const [filter, setFilter] = useState<GalleryFilter>('ALL')
  const [sort, setSort] = useState<GallerySort>('OLDEST')
  const [counts, setCounts] = useState<PhotoCounts>({ total: 0, featured: 0, linked: 0, unlinked: 0 })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  /** 每次换筛选 / 排序递增：丢弃过期的分页响应 */
  const pageGen = useRef(0)
  /** 先从地址栏读出视图状态，之后才开始写回，避免默认值覆盖用户打开的链接 */
  const [urlReady, setUrlReady] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detailId, setDetailId] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  /** 已请求的“筛选|排序”：同一组合不重复请求（开发模式 StrictMode 会把 effect 执行两次） */
  const lastQuery = useRef('')
  /** 读取第一页（进入页面、换筛选 / 排序时调用；上传后 force 刷新） */
  const loadFirstPage = useCallback(async (f: GalleryFilter, so: GallerySort, force = false) => {
    const key = `${f}|${so}`
    if (!force && lastQuery.current === key) return
    lastQuery.current = key
    const gen = ++pageGen.current
    try {
      const page = await tripApi.photoPage(tripId, { filter: f, sort: so, limit: PAGE })
      if (gen !== pageGen.current) return
      setPhotos(page.items); setNextCursor(page.nextCursor); setCounts(page.counts); setSelected(new Set())
    } catch (e) {
      if (gen === pageGen.current) lastQuery.current = '' // 失败后允许重试
      throw e
    }
  }, [tripId])

  const load = useCallback(async (quiet = false, f: GalleryFilter = 'ALL', so: GallerySort = 'OLDEST') => {
    if (!quiet) { setLoading(true); setLoadError('') }
    try {
      const [t, c] = await Promise.all([tripApi.get(tripId), tripApi.checkins(tripId), loadFirstPage(f, so)])
      setTrip(t); setCheckins(c)
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : '请稍后再试'
      if (quiet) showToast(`刷新失败：${msg}`); else setLoadError(msg)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [tripId, showToast, loadFirstPage])

  /** 滚动到底：读取下一页，返回追加后的完整列表（详情页翻到最后一张时用） */
  const loadMore = useCallback(async (): Promise<PhotoView[] | null> => {
    if (!nextCursor || pageLoading) return null
    const gen = pageGen.current
    setPageLoading(true)
    try {
      const page = await tripApi.photoPage(tripId, { filter, sort, cursor: nextCursor, limit: PAGE })
      if (gen !== pageGen.current) return null
      let merged: PhotoView[] = []
      setPhotos(ps => { const seen = new Set(ps.map(p => p.id)); merged = [...ps, ...page.items.filter(p => !seen.has(p.id))]; return merged })
      setNextCursor(page.nextCursor); setCounts(page.counts)
      return merged
    } catch (e) {
      showToast(e instanceof Error && e.message ? `加载更多失败：${e.message}` : '加载更多失败，请重试')
      return null
    } finally { setPageLoading(false) }
  }, [tripId, filter, sort, nextCursor, pageLoading, showToast])

  /** 修改后同步服务端统计（只取 1 张，开销很小） */
  const refreshCounts = useCallback(() => { tripApi.photoPage(tripId, { limit: 1 }).then(p => setCounts(p.counts)).catch(() => {}) }, [tripId])

  // 快速打卡保存了新照片：静默刷新当前筛选下的照片与计数（不整页重载）
  const { checkinVersion } = useQuickCheckIn()
  const seenVersion = useRef(checkinVersion)
  useEffect(() => {
    if (checkinVersion === seenVersion.current) return
    seenVersion.current = checkinVersion
    void load(true, filter, sort)
    refreshCounts()
  }, [checkinVersion, load, filter, sort, refreshCounts])

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const v = q.get('view'), f = q.get('filter'), s = q.get('sort')
    if (v === 'grid' || v === 'day') setView(v)
    if (FILTERS.some(([k]) => k === f)) setFilter(f as GalleryFilter)
    if (s === 'NEWEST' || s === 'OLDEST') setSort(s)
    const initialFilter = FILTERS.some(([k]) => k === f) ? (f as GalleryFilter) : 'ALL'
    const initialSort: GallerySort = s === 'NEWEST' ? 'NEWEST' : 'OLDEST'
    setUrlReady(true)
    localStorage.setItem('tabitrace-live-trip-id', String(tripId))
    if (hasSession()) userApi.me().then(u => { if (u.timezone) setTimeZone(u.timezone) }).catch(() => {})
    void load(false, initialFilter, initialSort)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在进入页面时按地址栏的筛选读取一次；之后由下面的 effect 负责
  }, [tripId])

  // 视图状态写回地址栏，刷新后保持
  useEffect(() => {
    if (!urlReady) return
    const q = new URLSearchParams(window.location.search)
    q.set('view', view); q.set('filter', filter); q.set('sort', sort)
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`)
  }, [view, filter, sort, urlReady])
  // 换筛选 / 排序：重新读取第一页（与已请求的组合相同则跳过，首次加载已经按地址栏读过）
  useEffect(() => {
    if (!urlReady) return
    loadFirstPage(filter, sort).catch(e => showToast(e instanceof Error && e.message ? `读取失败：${e.message}` : '读取失败，请重试'))
  }, [filter, sort, urlReady, loadFirstPage, showToast])

  const days = useMemo(() => (trip ? tripDays(trip) : []), [trip])
  const items = useMemo(() => (trip ? buildItems(photos, checkins, trip, timeZone) : []), [photos, checkins, trip, timeZone])
  const filterCount: Record<GalleryFilter, number> = { ALL: counts.total, FEATURED: counts.featured, LINKED: counts.linked, UNLINKED: counts.unlinked }
  // 服务端已按同样的规则筛选排序；这里再套一次，是为了让本地修改（取消精选、改关联）立即反映在当前列表里
  const list = useMemo(() => sortItems(filterItems(items, filter), sort), [items, filter, sort])
  const groups = useMemo(() => (view === 'day' ? groupByDay(list, days) : null), [view, list, days])
  const readOnly = trip?.status === 'ARCHIVED'
  const detailIndex = detailId === null ? -1 : list.findIndex(i => i.photo.id === detailId)
  const detail = detailIndex >= 0 ? list[detailIndex] : null

  // 详情翻到已加载的最后一张时先读下一页：新页到达后再前进一张
  const advanceFrom = useRef<number | null>(null)
  useEffect(() => {
    if (advanceFrom.current === null) return
    const i = list.findIndex(x => x.photo.id === advanceFrom.current)
    if (i >= 0 && i + 1 < list.length) { setDetailId(list[i + 1].photo.id); advanceFrom.current = null }
  }, [list])

  // 滚动到底自动读取下一页
  useEffect(() => {
    const el = sentinel.current
    if (!el || !nextCursor) return
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) void loadMore() }, { rootMargin: '800px' })
    io.observe(el)
    return () => io.disconnect()
  }, [nextCursor, loadMore])

  const replacePhoto = (p: PhotoView) => setPhotos(ps => ps.map(x => (x.id === p.id ? p : x)))

  const toggleFeatured = async (p: PhotoView) => {
    replacePhoto({ ...p, featured: !p.featured })
    try { replacePhoto(p.featured ? await tripApi.unfeaturePhoto(p.id) : await tripApi.featurePhoto(p.id)); refreshCounts(); showToast(p.featured ? '已取消精选' : '已设为精选，会优先用于分享成果与 Travel Story') }
    catch (e) { replacePhoto(p); showToast(e instanceof Error && e.message ? e.message : '操作失败，请重试') }
  }

  const setCover = async (p: PhotoView) => {
    try { setTrip(await tripApi.photoCover(tripId, p.id)); showToast('已设为旅行封面') }
    catch (e) { showToast(e instanceof Error && e.message ? e.message : '设置封面失败，请重试') }
  }

  const link = async (p: PhotoView, checkinId: number | null) => {
    try { replacePhoto(await tripApi.updatePhoto(p.id, { checkinId, capturedAt: p.capturedAt ?? null })); refreshCounts(); showToast(checkinId ? '已关联打卡' : '已取消关联打卡') }
    catch (e) { showToast(e instanceof Error && e.message ? e.message : '关联失败，请重试') }
  }

  const removePhotos = async (ids: number[]) => {
    setBusy(true)
    try {
      if (ids.length === 1) await tripApi.deletePhoto(ids[0]); else await tripApi.photoBatch(tripId, ids, 'DELETE')
      setPhotos(ps => ps.filter(p => !ids.includes(p.id)))
      refreshCounts()
      if (detailId !== null && ids.includes(detailId)) setDetailId(null)
      setSelected(new Set())
      showToast(`已删除 ${ids.length} 张照片`)
      if (trip && photos.some(p => ids.includes(p.id) && isCoverPhoto(trip.coverImage, p))) setTrip({ ...trip, coverImage: undefined })
    } catch (e) {
      showToast(e instanceof Error && e.message ? `删除失败：${e.message}` : '删除失败，请重试')
    } finally {
      setBusy(false); setConfirm(null)
    }
  }

  const batchFeature = async (featured: boolean) => {
    const ids = [...selected]
    setBusy(true)
    try {
      await tripApi.photoBatch(tripId, ids, featured ? 'FEATURE' : 'UNFEATURE')
      setPhotos(ps => ps.map(p => (ids.includes(p.id) ? { ...p, featured } : p)))
      refreshCounts()
      showToast(featured ? `已将 ${ids.length} 张设为精选` : `已取消 ${ids.length} 张的精选`)
      setSelected(new Set())
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : '批量操作失败，请重试')
    } finally { setBusy(false) }
  }

  const toggleSelect = (id: number) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const exitSelect = () => { setSelecting(false); setSelected(new Set()) }

  const card = (item: GalleryItem, index: number) => (
    <PhotoCard
      key={item.photo.id} item={item} index={index} selecting={selecting} selected={selected.has(item.photo.id)}
      isCover={isCoverPhoto(trip?.coverImage, item.photo)} readOnly={readOnly} menuOpen={menuFor === item.photo.id}
      onOpen={() => setDetailId(item.photo.id)} onToggleSelect={() => toggleSelect(item.photo.id)} onToggleFeatured={() => void toggleFeatured(item.photo)}
      onMenu={open => setMenuFor(open ? item.photo.id : null)} onCover={() => void setCover(item.photo)} onDelete={() => setConfirm([item.photo.id])}
    />
  )

  if (loadError) {
    return (
      <main><SiteHeader />
        <PageContainer variant="wide" className="gl-page">
          <div className="gl-fail" role="alert">
            <TriangleAlert size={22} />
            <p>照片加载失败</p>
            <small>{loadError}</small>
            <button type="button" className="gl-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
          </div>
        </PageContainer>
      </main>
    )
  }

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="wide" className={`gl-page${selecting && selected.size ? ' has-batch' : ''}`}>
        <header className="gl-head">
          <div className="gl-head-text">
            <p className="gl-eyebrow">TRAVEL GALLERY</p>
            <h1>{trip?.title ?? '旅行照片'}</h1>
            {trip && <p className="gl-head-meta"><b>{counts.total}</b> 张照片 · <b>{counts.featured}</b> 张精选</p>}
          </div>
          {trip && !readOnly && counts.total > 0 && (
            <div className="gl-head-actions">
              <button type="button" className={`gl-btn${selecting ? ' is-dark' : ''}`} onClick={() => (selecting ? exitSelect() : setSelecting(true))} aria-pressed={selecting}>
                {selecting ? <><X size={15} /> 完成</> : <><CheckSquare size={15} /> 选择</>}
              </button>
              <button type="button" className="gl-btn is-primary gl-add-desktop" onClick={() => setUploadOpen(true)}><Plus size={15} /> 添加照片</button>
            </div>
          )}
        </header>
        <LiveTripSubnav tripId={tripId} />

        {loading || !trip ? <PhotoGridSkeleton /> : counts.total === 0 ? (
          <div className="gl-empty">
            <ImagePlus size={30} aria-hidden="true" />
            <h2>还没有旅行照片</h2>
            <p>把旅途中值得记住的画面放进这里。</p>
            {!readOnly && <button type="button" className="gl-btn is-primary" onClick={() => setUploadOpen(true)}><Plus size={15} /> 添加第一张照片</button>}
          </div>
        ) : (
          <>
            {readOnly && <p className="gl-note">这段旅行已归档，照片只能查看和下载。</p>}
            <div className="gl-featured-tip">
              <Star size={15} aria-hidden="true" />
              <p><b>精选照片</b>会优先用于 <Link href={`/trips/${tripId}/share`}>分享成果</Link> 与 <Link href={`/trips/${tripId}/video`}>Travel Story</Link>，目前 {counts.featured} 张。</p>
            </div>

            <div className="gl-toolbar">
              <div className="gl-filters" role="tablist" aria-label="筛选照片">
                {FILTERS.map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>
                    {l}<small>{filterCount[k]}</small>
                  </button>
                ))}
              </div>
              <div className="gl-toolbar-right">
                <div className="gl-seg" role="radiogroup" aria-label="查看方式">
                  <button type="button" role="radio" aria-checked={view === 'day'} className={view === 'day' ? 'is-active' : ''} onClick={() => setView('day')}>按天</button>
                  <button type="button" role="radio" aria-checked={view === 'grid'} className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}>网格</button>
                </div>
                <label className="sr-only" htmlFor="gl-sort">排序</label>
                <select id="gl-sort" className="gl-input gl-sort" value={sort} onChange={e => setSort(e.target.value as GallerySort)}>
                  <option value="OLDEST">最早在前</option>
                  <option value="NEWEST">最新在前</option>
                </select>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="gl-empty is-small">
                {filter === 'FEATURED'
                  ? <><h2>还没有精选照片</h2><p>点击照片上的星标，把喜欢的照片加入精选。</p></>
                  : <><h2>{filter === 'LINKED' ? '还没有关联打卡的照片' : '所有照片都已关联打卡'}</h2><p>在照片详情里可以修改关联的打卡。</p></>}
              </div>
            ) : groups ? (
              groups.map(g => (
                <section key={g.key} className="gl-day" aria-labelledby={`gl-day-${g.key}`}>
                  <h2 id={`gl-day-${g.key}`}><b>{g.title}</b><span>{g.subtitle}</span><small>{g.items.length} 张</small></h2>
                  <div className="gl-grid">{g.items.map(i => card(i, list.indexOf(i)))}</div>
                </section>
              ))
            ) : (
              <div className="gl-grid">{list.map((i, idx) => card(i, idx))}</div>
            )}

            {nextCursor && (
              <div ref={sentinel} className="gl-more">
                <button type="button" className="gl-btn" disabled={pageLoading} onClick={() => void loadMore()}>{pageLoading ? '正在加载…' : `加载更多（还有 ${Math.max(0, filterCount[filter] - list.length)} 张）`}</button>
              </div>
            )}
          </>
        )}

        {!readOnly && trip && !selecting && (
          <button type="button" className="gl-fab" onClick={() => setUploadOpen(true)} aria-label="添加照片"><Plus size={24} /></button>
        )}

        {selecting && (
          <div className="gl-batch" role="region" aria-label="批量操作">
            <p aria-live="polite">{selected.size ? `已选择 ${selected.size} 张` : '点选照片进行批量操作'}</p>
            <div className="gl-batch-actions">
              <button type="button" className="gl-btn" onClick={() => setSelected(selected.size === list.length ? new Set() : new Set(list.map(i => i.photo.id)))}>{selected.size === list.length ? '全不选' : nextCursor ? `全选已加载的 ${list.length} 张` : '全选'}</button>
              <button type="button" className="gl-btn is-primary" disabled={!selected.size || busy} onClick={() => void batchFeature(true)}><Star size={14} /> 设为精选</button>
              <button type="button" className="gl-btn" disabled={!selected.size || busy} onClick={() => void batchFeature(false)}><StarOff size={14} /> 取消精选</button>
              <button type="button" className="gl-btn is-danger" disabled={!selected.size || busy} onClick={() => setConfirm([...selected])}><Trash2 size={14} /> 删除</button>
            </div>
          </div>
        )}

        {toast && <div className="ts-toast" role="status" aria-live="polite">{toast}</div>}

        {detail && trip && (
          <PhotoDetail
            tripId={tripId} item={detail} position={detailIndex + 1} total={Math.max(list.length, filterCount[filter])} checkins={checkins}
            isCover={isCoverPhoto(trip.coverImage, detail.photo)} readOnly={readOnly}
            onClose={() => setDetailId(null)}
            onPrev={() => setDetailId(list[(detailIndex - 1 + list.length) % list.length].photo.id)}
            onNext={() => {
              // 翻到已加载的最后一张且还有下一页：先读下一页再前进
              if (detailIndex === list.length - 1 && nextCursor) { advanceFrom.current = detail.photo.id; void loadMore(); return }
              setDetailId(list[(detailIndex + 1) % list.length].photo.id)
            }}
            onToggleFeatured={() => toggleFeatured(detail.photo)}
            onCover={() => setCover(detail.photo)}
            onDelete={() => setConfirm([detail.photo.id])}
            onLink={id => link(detail.photo, id)}
          />
        )}

        {uploadOpen && trip && (
          <UploadDialog tripId={tripId} checkins={checkins} freeUsed={trip.planType === 'FREE' ? counts.total : null}
            onClose={() => setUploadOpen(false)} onUploaded={n => { showToast(`已上传 ${n} 张照片`); void loadFirstPage(filter, sort, true).catch(() => {}) }} />
        )}

        {confirm && (
          <ConfirmDialog
            title={confirm.length > 1 ? `删除 ${confirm.length} 张照片？` : '删除这张照片？'}
            body={<p>删除后无法恢复。照片会从关联的打卡、分享成果和 Travel Story 的素材中移除；如果它是旅行封面，封面会被清空。已经生成的视频不受影响。</p>}
            onCancel={() => { if (!busy) setConfirm(null) }}
            actions={<>
              <button type="button" className="st-btn" onClick={() => setConfirm(null)} disabled={busy}>取消</button>
              <button type="button" className="st-btn is-danger-fill" onClick={() => void removePhotos(confirm)} disabled={busy}>{busy ? '正在删除…' : '删除'}</button>
            </>}
          />
        )}
      </PageContainer>
    </main>
  )
}
