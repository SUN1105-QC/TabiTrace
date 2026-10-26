'use client'

/**
 * 分享工作台（旅行详情 > 分享）：城市海报 / 九宫格 / 每日长图，预览、编辑、导出，以及分享链接。
 * 手机上按“图片编辑工作台”组织：标题 → 旅行子导航 → 模板分段 → 导出操作 → 成品预览（视觉焦点）→ 素材编辑 → 分享链接 → Trip Pro；
 * 桌面为左侧预览、右侧编辑栏。
 * 九宫格：预览里的照片格和素材区的已选条都可以点选；选中一格后从素材列表挑照片放进去，选满后点素材进入替换。
 * 九宫格有两种格式（标准 / 旅行手帐），共用同一套素材选择，只是排版不同。
 * 「查看大图」在全屏遮罩里再渲染一份不可编辑的成品，方便在手机上看清细节。
 */

import { PageContainer } from '@/components/common/PageContainer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ImageOff, Maximize2, X } from 'lucide-react'
import { toPng } from 'html-to-image'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { ShareResultLong } from '@/components/share/ShareResultLong'
import { ShareGridCard } from '@/components/share/ShareGridCard'
import { TravelScrapbookTemplate } from '@/components/share/scrapbook/TravelScrapbookTemplate'
import { NineGridTemplateSelector } from '@/components/share/studio/NineGridTemplateSelector'
import { SharePreviewLightbox } from '@/components/share/studio/SharePreviewLightbox'
import { CityPoster } from '@/components/share/poster/CityPoster'
import { PosterMaterialPanel } from '@/components/share/poster/PosterMaterialPanel'
import { ShareScaleFrame } from '@/components/share/ShareScaleFrame'
import { NineGridEditor, type GridEditState } from '@/components/share/studio/NineGridEditor'
import { ShareActionBar, ShareLinkCard, ShareTemplateTabs, TripProCard, type ShareMode } from '@/components/share/studio/ShareStudioParts'
import { DEFAULT_GRID_OPTIONS, gridSlotCount, placeInSlot, scopePhotos, swapSlots, type GridOptions } from '@/utils/share-grid'
import { DEFAULT_POSTER_OPTIONS, buildPosterData, type PosterOptions } from '@/utils/poster-data'
import { exportPosterPng } from '@/utils/export-poster'
import { deliverFiles, exportGridTiles, upgradeImagesForExport, waitForImages } from '@/utils/share-export'
import { shareTierOf, watermarkDataUrl } from '@/utils/share-tier'
import type { TripProPlan } from '@/utils/plan'
import { planApi, tripApi, type AchievementView, type ItineraryView, type PhotoView, type ShareLinkView, type TimelineDay, type TripSummary, type TripView } from '@/services/tabitrace-api'

const NO_EDIT: GridEditState = { activeSlot: null, pending: null }
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export default function SharePage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const [trip, setTrip] = useState<TripView | null>(null)
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [photos, setPhotos] = useState<PhotoView[]>([])
  const [timeline, setTimeline] = useState<TimelineDay[]>([])
  const [achievements, setAchievements] = useState<AchievementView[]>([])
  const [links, setLinks] = useState<ShareLinkView[]>([])
  const [itinerary, setItinerary] = useState<ItineraryView[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ShareMode>('poster')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState('')
  const [creating, setCreating] = useState(false)
  const [posterOpts, setPosterOpts] = useState<PosterOptions>(DEFAULT_POSTER_OPTIONS)
  const [gridOpts, setGridOpts] = useState<GridOptions>(DEFAULT_GRID_OPTIONS)
  const [edit, setEdit] = useState<GridEditState>(NO_EDIT)
  const [bigView, setBigView] = useState(false)
  const [plan, setPlan] = useState<TripProPlan | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const modeFromUrl = useRef(false)

  const reload = useCallback(async () => {
    try {
      // 行程只用于海报的「探索进度」（非官方城市时按计划地点算），读不到时不影响其余内容
      const [t, s, p, tl, a, l, it] = await Promise.all([tripApi.get(tripId), tripApi.summary(tripId), tripApi.photos(tripId), tripApi.timeline(tripId), tripApi.achievements(tripId), tripApi.shares(tripId), tripApi.itinerary(tripId).catch(() => [] as ItineraryView[])])
      setTrip(t); setSummary(s); setPhotos(p); setTimeline(tl); setAchievements(a); setLinks(l); setItinerary(it)
      // 从 Trip Pro 页等处带 ?mode=nine / long 进来时，第一次加载完成后打开对应的成果
      if (!modeFromUrl.current) {
        modeFromUrl.current = true
        const wanted = new URLSearchParams(window.location.search).get('mode')
        if (wanted === 'poster' || wanted === 'nine' || wanted === 'long') setMode(wanted)
      }
    } catch (e) {
      setError(message(e, '分享数据加载失败，请稍后重试'))
    } finally {
      setLoading(false)
    }
  }, [tripId])
  useEffect(() => { void reload() }, [reload])
  // 分享图规格（Free / Pro）来自方案配置；读不到时 shareTierOf 用与后端一致的默认值
  useEffect(() => { planApi.tripPro().then(setPlan).catch(() => setPlan(null)) }, [])
  const tier = shareTierOf(trip, plan)
  /** Trip Pro 去水印：成品里不显示品牌署名 */
  const brandClass = tier.watermark ? undefined : 'ss-no-brand'
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const switchMode = (m: ShareMode) => { setMode(m); setEdit(NO_EDIT) }
  const scrapbook = mode === 'nine' && gridOpts.format === 'scrapbook'
  const slots = gridSlotCount(gridOpts.format)
  const fileTag = scrapbook ? 'scrapbook' : mode
  const modeName = mode === 'poster' ? '城市海报' : mode === 'long' ? '每日长图' : scrapbook ? '九宫格 · 旅行手帐' : '九宫格'

  /** 当前成品：预览里可点选照片格（interactive），大图里只读 */
  /** 城市海报的数据：API 数据 + 海报素材选择 → PosterData（海报组件只读这一份） */
  const posterData = useMemo(() => (trip && summary ? buildPosterData({ trip, summary, photos, timeline, itinerary, options: posterOpts }) : null), [trip, summary, photos, timeline, itinerary, posterOpts])
  /** 整趟旅行一张照片都没有：城市海报显示空状态，不导出 */
  const posterEmpty = mode === 'poster' && !loading && photos.length === 0

  const renderResult = (t: TripView, s: TripSummary, interactive: boolean) => {
    const slot = interactive ? { activeSlot: edit.activeSlot, onSlot: (i: number) => selectSlot(i, true) } : {}
    if (mode === 'poster') {
      if (photos.length === 0) return (
        <div className="cp-empty">
          <ImageOff size={28} aria-hidden="true" />
          <p>这趟旅行还没有照片，上传照片后即可生成城市海报。</p>
          <Link href={`/trips/${t.id}/gallery`} className="ss-btn is-dark">去上传照片</Link>
        </div>
      )
      return posterData ? <CityPoster data={posterData} tripId={t.id} /> : null
    }
    if (scrapbook) return <TravelScrapbookTemplate trip={t} summary={s} timeline={timeline} photos={photos} options={gridOpts} {...slot} />
    if (mode === 'nine') return <ShareGridCard trip={t} summary={s} timeline={timeline} photos={photos} options={gridOpts} {...slot} />
    return <ShareResultLong trip={t} summary={s} timeline={timeline} photos={photos} achievements={achievements} />
  }

  // ---------- 导出 ----------
  async function download() {
    if (!ref.current || exporting) return
    setExporting('整张'); setError('')
    try {
      setEdit(NO_EDIT) // 选中描边不能进入成品
      await nextFrame()
      // 城市海报只截取海报组件本身，按规格宽度导出；其他成品按规格倍率导出；Free 旅行再加水印
      const poster = mode === 'poster' ? ref.current.querySelector<HTMLElement>('.cp-poster') : null
      if (mode === 'poster' && !poster) throw new Error('海报还没有生成')
      let data: string
      // 预览用中图；按导出倍率不够清晰的照片临时换成原图，导出后换回
      const target = poster ?? ref.current
      await waitForImages(target)
      const restore = await upgradeImagesForExport(target, poster ? tier.posterWidth / poster.offsetWidth : tier.scale, photos)
      try {
        if (poster) data = await exportPosterPng(poster, tier.posterWidth)
        else data = await toPng(ref.current, { cacheBust: true, includeQueryParams: true, pixelRatio: tier.scale })
      } finally { restore() }
      if (tier.watermark) data = await watermarkDataUrl(data)
      const a = document.createElement('a')
      a.download = `tabitrace-${trip?.id}-${fileTag}.png`
      a.href = data
      a.click()
      setToast('PNG 已导出')
    } catch (e) {
      setError(`导出失败：${message(e, 'PNG 生成失败，请稍后重试')}`)
    } finally {
      setExporting('')
    }
  }

  async function downloadTiles() {
    if (exporting) return
    setEdit(NO_EDIT)
    await nextFrame()
    const card = ref.current?.querySelector<HTMLElement>('.sg-card, .sb-canvas')
    if (!card) return
    setExporting(`正在生成 0/${scrapbook ? card.querySelectorAll('.sb-card').length : 9}`); setError('')
    try {
      await waitForImages(card)
      // 单张按 tileSize 导出：按最窄的一格估算倍率，不够清晰的照片换成原图
      const cells = Array.from(card.querySelectorAll<HTMLElement>(scrapbook ? '.sb-card' : '.sg-tile'))
      const restore = await upgradeImagesForExport(card, tier.tileSize / Math.max(1, Math.min(...cells.map(c => c.offsetWidth))), photos)
      const files = await exportGridTiles(card, `tabitrace-${trip?.id}-${scrapbook ? 'scrapbook-card' : 'grid'}`, tier, (done, total) => setExporting(`正在生成 ${done}/${total}`))
      restore()
      const how = await deliverFiles(files)
      if (how !== 'cancelled') setToast(how === 'shared' ? `${files.length} 张图片已准备好` : `已导出 ${files.length} 张图片`)
    } catch (e) {
      setError(`导出失败：${message(e, '九宫格导出失败，请稍后重试')}`)
    } finally {
      setExporting('')
    }
  }

  // ---------- 分享链接 ----------
  async function createShare() {
    setCreating(true)
    try {
      const l = await tripApi.createShare(tripId)
      await reload()
      try { await navigator.clipboard?.writeText(l.url); setToast('分享链接已创建并复制') } catch { setToast('分享链接已创建') }
    } catch (e) {
      setError(message(e, '创建分享链接失败'))
    } finally {
      setCreating(false)
    }
  }
  async function copyLink(l: ShareLinkView) {
    try { await navigator.clipboard.writeText(l.url); setToast('链接已复制') } catch { setToast('复制失败，请长按链接手动复制') }
  }
  async function revokeLink(l: ShareLinkView) {
    if (!window.confirm('删除后，拿到这个链接的人将无法再访问分享页。确定删除吗？')) return
    try { await tripApi.revokeShare(tripId, l.id); setToast('分享链接已删除'); await reload() } catch (e) { setError(message(e, '删除失败，请重试')) }
  }

  // ---------- 九宫格编辑 ----------
  const chosen = () => {
    const scoped = new Set(scopePhotos(photos, timeline, gridOpts.day).map(p => p.id))
    return gridOpts.photoIds.filter(id => scoped.has(id)).slice(0, slots)
  }
  const setChosen = (photoIds: number[]) => setGridOpts(o => ({ ...o, photoIds }))

  /** 点选一个照片格（预览或已选条） */
  function selectSlot(slot: number, fromPreview = false) {
    const list = chosen()
    if (edit.pending != null) {
      setChosen(placeInSlot(list, edit.pending, slot, slots))
      setEdit(NO_EDIT)
      setToast(`已替换第 ${Math.min(slot, list.length) + 1} 格`)
      return
    }
    if (edit.activeSlot === slot) { setEdit(NO_EDIT); return }
    if (edit.activeSlot != null && edit.activeSlot < list.length && slot < list.length) {
      setChosen(swapSlots(list, edit.activeSlot, slot))
      setEdit(NO_EDIT)
      setToast(`已交换第 ${edit.activeSlot + 1} 格和第 ${slot + 1} 格`)
      return
    }
    setEdit({ activeSlot: slot, pending: null })
    // 手机上预览与素材区上下排列：点预览里的格子后把素材区带到眼前
    if (fromPreview && window.matchMedia('(max-width: 1279px)').matches) document.getElementById('ss-grid-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** 点素材：放进选中的格子 / 移出 / 加入 / 选满时进入替换 */
  function pickPhoto(photoId: number) {
    const list = chosen()
    if (edit.activeSlot != null) {
      setChosen(placeInSlot(list, photoId, edit.activeSlot, slots))
      setToast(`已放入第 ${Math.min(edit.activeSlot, list.length) + 1} 格`)
      setEdit(NO_EDIT)
      return
    }
    if (list.includes(photoId)) { setChosen(list.filter(id => id !== photoId)); setEdit(NO_EDIT); return }
    if (list.length < slots) { setChosen([...list, photoId]); return }
    setEdit({ activeSlot: null, pending: edit.pending === photoId ? null : photoId })
  }

  const busy = Boolean(exporting)
  return (
    <main>
      <SiteHeader />
      <PageContainer variant="wide" className="ss-page">
        <header className="ss-head">
          <p>SHARE STUDIO · LIVE DATA</p>
          <h1>{trip?.title || '分享成果'}</h1>
        </header>
        <LiveTripSubnav tripId={tripId} />

        {error && (
          <div className="ss-alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setError('')} aria-label="关闭提示"><X size={15} /></button>
          </div>
        )}

        <div className="ss-toolbar">
          <ShareTemplateTabs value={mode} onChange={switchMode} />
          <ShareActionBar mode={mode} tilesLabel={scrapbook ? '分别导出照片卡' : undefined} busy={busy || !trip || posterEmpty} progress={exporting} onExport={() => void download()} onExportTiles={() => void downloadTiles()} />
        </div>
        {mode === 'nine' && <NineGridTemplateSelector value={gridOpts.format ?? 'classic'} onChange={format => { setGridOpts(o => ({ ...o, format })); setEdit(NO_EDIT) }} />}

        <div className="ss-layout">
          <div className="ss-stage">
            <div className="ss-preview" aria-busy={loading}>
              {loading ? <div className="ss-skeleton" aria-label="正在加载预览" />
                : trip && summary ? (
                  <ShareScaleFrame key={scrapbook ? 'scrapbook' : mode}>
                    <div ref={ref} className={brandClass}>{renderResult(trip, summary, true)}</div>
                  </ShareScaleFrame>
                ) : <p className="ss-desc">暂时无法生成预览。</p>}
            </div>
            {!loading && trip && summary && !posterEmpty && (
              <div className="ss-preview-foot">
                <p className="ss-preview-tip">{mode !== 'nine' ? (tier.watermark ? '预览已按屏幕缩小。免费旅行导出标准清晰度，并带水印。' : '预览已按屏幕缩小，导出的是高清无水印原图。') : scrapbook ? '点预览里的照片卡，可以换照片或设为主图。' : '点预览里的照片格，可以换成指定的照片。'}</p>
                <button type="button" className="ss-zoom-btn" onClick={() => { setEdit(NO_EDIT); setBigView(true) }} aria-haspopup="dialog">
                  <Maximize2 size={15} aria-hidden="true" />查看大图
                </button>
              </div>
            )}
          </div>

          <aside className="ss-side">
            {mode === 'poster' && trip && posterData && (
              <PosterMaterialPanel trip={trip} timeline={timeline} photos={photos} value={posterOpts} onChange={setPosterOpts}
                auto={{ mainId: posterData.mainPhoto?.id, secondaryIds: posterData.secondaryPhotos.map(p => p.id) }}
                onExport={() => void download()} exporting={busy} />
            )}
            {mode === 'nine' && trip && (
              <NineGridEditor
                trip={trip} timeline={timeline} photos={photos} value={gridOpts} state={edit}
                onDay={day => { const inScope = new Set(scopePhotos(photos, timeline, day).map(p => p.id)); setGridOpts(o => ({ ...o, day, photoIds: o.photoIds.filter(id => inScope.has(id)) })); setEdit(NO_EDIT) }}
                onSlot={i => selectSlot(i)}
                onPick={pickPhoto}
                onRemove={i => { setChosen(chosen().filter((_, j) => j !== i)); setEdit(NO_EDIT) }}
                onReset={() => { setChosen([]); setEdit(NO_EDIT) }}
                onCancel={() => setEdit(NO_EDIT)}
                onCover={photoId => { setGridOpts(o => ({ ...o, coverPhotoId: photoId })); setEdit(NO_EDIT); setToast('已设为主图') }}
                onLayout={layout => setGridOpts(o => ({ ...o, layout }))}
              />
            )}
            {trip && <ShareLinkCard links={links} creating={creating} onCreate={() => void createShare()} onCopy={l => void copyLink(l)} onRevoke={l => void revokeLink(l)} />}
            {trip && <TripProCard trip={trip} tier={tier} />}
          </aside>
        </div>

        {toast && <div className="ss-toast" role="status" aria-live="polite">{toast}</div>}
        {bigView && trip && summary && (
          <SharePreviewLightbox title={modeName} onClose={() => setBigView(false)}><div className={brandClass}>{renderResult(trip, summary, false)}</div></SharePreviewLightbox>
        )}
      </PageContainer>
    </main>
  )
}
