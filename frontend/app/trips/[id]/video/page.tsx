'use client'

/**
 * Travel Story · AI 旅行视频制作工作台。
 * 桌面（≥1024）：左侧五步创作（模板 → 素材 → 内容与风格 → 视频设置 → 生成），右侧 sticky 实时预览与项目信息，底部是我的视频。
 * 移动端 / 平板（<1024）：Mobile Travel Story Studio —— 预览置顶 → 横向步骤导航 → 只显示当前一步 → 底部固定「上一步 / 下一步 / 生成」→ 我的视频。
 * 两种布局共用同一份 DOM、同一个 VideoDraft 与同一套请求；页面只负责编排状态，模板、音乐、分镜、FREE / PRO 规则和渲染进度全部来自后端。
 */

import { PageContainer } from '@/components/common/PageContainer'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Film, RefreshCcw, Save, Sparkles, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { VideoStoryboard, applySegments } from '@/components/video/VideoStoryboard'
import { StudioStep } from '@/components/video/studio/StudioStep'
import { StudioSteps, useActiveStep, type StepItem } from '@/components/video/studio/StudioSteps'
import { TemplatePicker } from '@/components/video/studio/TemplatePicker'
import { MaterialPicker } from '@/components/video/studio/MaterialPicker'
import { ShotTimeline } from '@/components/video/studio/ShotTimeline'
import { timeOfDay } from '@/lib/time'
import { ContentStyle } from '@/components/video/studio/ContentStyle'
import { MusicSelector, type MusicLoadState } from '@/components/video/music/MusicSelector'
import { BottomSheet, MusicCard } from '@/components/video/studio/MusicCard'
import { VideoSpecs } from '@/components/video/studio/VideoSpecs'
import { GeneratePanel } from '@/components/video/studio/GeneratePanel'
import { PreviewPanel } from '@/components/video/studio/PreviewPanel'
import { ProjectSummary } from '@/components/video/studio/ProjectSummary'
import { SmartSuggestion } from '@/components/video/studio/SmartSuggestion'
import { LatestVideo, type ProjectActions } from '@/components/video/studio/LatestVideo'
import { MyVideos } from '@/components/video/studio/MyVideos'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ApiError } from '@/services/api'
import { planApi, tripApi, type CheckinView, type PhotoView, type TripView } from '@/services/tabitrace-api'
import { videoApi } from '@/services/video'
import type { Plan, StorySettings, Storyboard, VideoDraft, VideoMusic, VideoProject, VideoTemplate } from '@/types/video'
import type { StoryTier } from '@/utils/plan'
import { PLAN_LIMITS, isPlayable, isRunning, utcDate } from '@/utils/video-status'
import { autoSelectPhotos } from '@/utils/video-autoselect'
import { photoHours, placeCount, styleOf, suggestion, type Suggestion } from '@/utils/video-studio'
import { DEFAULT_MUSIC_VOLUME, defaultMusicFor, draftMusic, selectionLabel, selectionOf, selectionProblem, type MusicContext } from '@/utils/video-music'
import { useUserMusic } from '@/hooks/useUserMusic'
import { photoMedium, photoThumb } from '@/utils/photo-variants'
import type { PhotoView as VariantPhoto } from '@/services/tabitrace-api'
const mediumOf = (p?: VariantPhoto) => (p ? photoMedium(p) : undefined)
const thumbOf = (p?: VariantPhoto) => (p ? photoThumb(p) : undefined)

/** 自动挑选时最多取的张数：30 秒视频里每张约 2 秒最舒服，超过的可以手动加选 */
const AUTO_PICK = 12
const STEP_IDS = ['vs-step-1', 'vs-step-2', 'vs-step-3', 'vs-step-4', 'vs-step-5']
/** 低于 1024px 使用移动端分步工作台；桌面布局保持不变 */
const MOBILE_QUERY = '(max-width: 1023px)'
/** 移动端第 3 步的子区域；默认「基础文案」 */
type ContentTab = 'text' | 'display' | 'style' | 'music'
const CONTENT_TABS: [ContentTab, string][] = [['text', '基础文案'], ['display', '画面信息'], ['style', '视频风格'], ['music', '背景音乐']]
type Tiers = { FREE: StoryTier; PRO: StoryTier }
const QUALITY_RANK: Record<string, number> = { '720p': 1, '1080p': 2 }
const qualityRank = (q: string) => QUALITY_RANK[q.toLowerCase()] ?? 99

const defaultSettings = (): StorySettings => ({
  title: null,
  endingText: null,
  showTitle: true,
  showDate: true,
  showPlaceNames: true,
  showCheckinText: true,
  showWeather: true,
  showStats: true,
  showAchievements: false,
  showEnding: true,
  segments: [],
  visualStyle: 'NATURAL',
  musicVolume: DEFAULT_MUSIC_VOLUME
})

/** 预览是否过期只看会影响分镜的设置；视觉风格只调色、音乐音量只影响成片，都不需要重新编排 */
const storyKey = (d: VideoDraft) => JSON.stringify({ ...d, settings: { ...d.settings, visualStyle: null, musicVolume: null } })
const friendly = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : '操作失败，请稍后再试')
const hhmm = (d: Date) => timeOfDay(d)
const isTextInput = (el: EventTarget | null) => el instanceof HTMLTextAreaElement
  || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color'].includes(el.type))

export default function TravelStoryPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)
  const mobile = useMediaQuery(MOBILE_QUERY)

  // ── 数据 ──
  const [trip, setTrip] = useState<TripView | null>(null)
  const [photos, setPhotos] = useState<PhotoView[]>([])
  const [checkins, setCheckins] = useState<CheckinView[]>([])
  const [projects, setProjects] = useState<VideoProject[]>([])
  const [templates, setTemplates] = useState<VideoTemplate[]>([])
  const [music, setMusic] = useState<VideoMusic[]>([])
  const [musicStatus, setMusicStatus] = useState<MusicLoadState>('loading')
  // 「我的音乐」（会员上传）：与音乐选择器共用同一份数据，用于摘要与生成前检查
  const mine = useUserMusic()
  // 用户是否亲自选过音乐（或打开的是已保存的项目）：没选过时，切换模板会跟着换成新模板的推荐音乐
  const [musicTouched, setMusicTouched] = useState(false)
  // Free / Pro 的照片数、时长、清晰度、水印：以后端方案配置为准，接口失败时才用本地兜底
  const [tiers, setTiers] = useState<Tiers>(PLAN_LIMITS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // ── 编辑器 ──
  const [draft, setDraft] = useState<VideoDraft | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [savedKey, setSavedKey] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [touched, setTouched] = useState<number[]>([])
  const draftRef = useRef<VideoDraft | null>(null)
  draftRef.current = draft

  // ── 预览 ──
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null)
  const [previewKey, setPreviewKey] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [demoTemplate, setDemoTemplate] = useState<string | null>(null)
  const autoKey = useRef('')

  // ── 项目 ──
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [playSignal, setPlaySignal] = useState(0)
  const [toast, setToast] = useState('')
  const [actionError, setActionError] = useState('')
  // 桌面按滚动位置联动；必须等步骤卡渲染出来（加载完成）后再开始观察，移动端分步模式不联动
  const [activeStep, setActiveStep] = useActiveStep(STEP_IDS, !mobile && !loading)

  // ── 移动端 ──
  const [contentTab, setContentTab] = useState<ContentTab>('text')
  const [musicSheet, setMusicSheet] = useState(false)
  const [typing, setTyping] = useState(false)

  const plan: Plan = trip?.planType === 'PRO' ? 'PRO' : 'FREE'
  const limits = tiers[plan]
  const photosById = useMemo(() => new Map(photos.map(p => [p.id, p])), [photos])
  const checkinsById = useMemo(() => new Map(checkins.map(c => [c.id, c])), [checkins])
  const draftKey = draft ? JSON.stringify(draft) : ''
  const dirty = Boolean(storyboard) && Boolean(draft) && storyKey(draft!) !== previewKey
  // V3 之前创建的项目没有名称：按「旅行标题 · 模板」显示，方便区分多个版本
  const named = useMemo(() => projects.map(p => (p.name ? p : { ...p, name: `${trip?.title ?? '旅行视频'} · ${templates.find(t => t.code === p.templateCode)?.englishName ?? p.templateCode}` })), [projects, trip?.title, templates])
  const focused = named.find(p => p.id === focusedId) ?? named[0] ?? null
  const running = projects.some(p => isRunning(p))

  const refreshPreview = useCallback(async (d?: VideoDraft) => {
    const current = d ?? draftRef.current
    if (!current) return
    if (current.photoIds.length === 0) { setPreviewError('请先选择至少一张照片'); return }
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const sb = await videoApi.preview(tripId, current)
      setStoryboard(sb)
      setPreviewKey(storyKey(current))
    } catch (e) {
      setPreviewError(friendly(e))
    } finally {
      setPreviewLoading(false)
    }
  }, [tripId])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [t, ps, cs, vs, tpls, ms, tripPro] = await Promise.all([
        tripApi.get(tripId), tripApi.photos(tripId), tripApi.checkins(tripId),
        videoApi.list(tripId), videoApi.templates(), videoApi.music().catch(() => null),
        planApi.tripPro().catch(() => null)
      ])
      const tierMap: Tiers = tripPro ? { FREE: tripPro.storyFree, PRO: tripPro.storyPro } : PLAN_LIMITS
      setTrip(t); setPhotos(ps); setCheckins(cs); setProjects(vs); setTemplates(tpls); setMusic(ms ?? []); setTiers(tierMap)
      setMusicStatus(ms ? 'ready' : 'error')
      setFocusedId(vs[0]?.id ?? null)
      const p: Plan = t.planType === 'PRO' ? 'PRO' : 'FREE'
      const tier = tierMap[p]
      const pickedIds = autoSelectPhotos(ps, cs, Math.min(AUTO_PICK, tier.maxPhotos))
      const duration = tier.durations.includes(30) ? 30 : tier.durations[0]
      const initial: VideoDraft = {
        templateCode: 'JOURNAL',
        aspectRatio: '9:16',
        duration,
        quality: tier.quality,
        // 默认音乐：模板在后台配置的推荐曲 → 规则推荐里当前方案能用的第一首；曲库读不到时先不加音乐
        ...draftMusic((code => (code ? { source: 'SYSTEM' as const, code } : null))(defaultMusicFor(ms ?? [], {
          templateCode: 'JOURNAL', destination: `${t.destinationName ?? ''} ${t.city ?? ''}`, duration,
          photoHours: photoHours(pickedIds, ps), photoCount: pickedIds.length, plan: p,
          templateDefault: tpls.find(x => x.code === 'JOURNAL')?.recommendedMusic ?? null
        }))),
        coverPhotoId: null,
        photoIds: pickedIds,
        settings: defaultSettings()
      }
      setDraft(initial)
      if (initial.photoIds.length) void refreshPreview(initial)
    } catch (e) {
      setLoadError(friendly(e))
    } finally {
      setLoading(false)
    }
  }, [tripId, refreshPreview])

  useEffect(() => { void load() }, [load])

  /** 只重新读取曲库（音乐区的「重新加载」） */
  const retryMusic = useCallback(async () => {
    setMusicStatus('loading')
    try { setMusic(await videoApi.music()); setMusicStatus('ready') } catch { setMusicStatus('error') }
  }, [])

  // 有任务在排队 / 生成时轮询后端真实状态
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      videoApi.list(tripId).then(setProjects).catch(() => { /* 下一次轮询重试 */ })
    }, 1500)
    return () => clearInterval(id)
  }, [running, tripId])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  // 移动端：顶部预览很小，没有位置放「重新预览」提示，设置停止变化 0.9 秒后自动按最新草稿重新编排
  // 同一份草稿只自动请求一次，预览失败时不会反复重试
  useEffect(() => {
    if (!mobile || !draft || previewLoading || draft.photoIds.length === 0) return
    if (storyboard && !dirty) return
    const key = storyKey(draft)
    if (autoKey.current === key) return
    const id = setTimeout(() => { autoKey.current = key; void refreshPreview() }, 900)
    return () => clearTimeout(id)
  }, [mobile, draft, dirty, storyboard, previewLoading, refreshPreview])

  // 移动端：输入框获得焦点（软键盘弹出）时收起底部操作栏，避免挡住正在输入的内容
  useEffect(() => {
    if (!mobile) return
    const onIn = (e: FocusEvent) => { if (isTextInput(e.target)) setTyping(true) }
    const onOut = (e: FocusEvent) => { if (isTextInput(e.target)) setTyping(false) }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); setTyping(false) }
  }, [mobile])

  /** step：这次修改属于第几步，用来点亮步骤导航里的小勾 */
  const patch = (p: Partial<VideoDraft>, step?: number) => {
    setDraft(d => (d ? { ...d, ...p } : d))
    if (step && !touched.includes(step)) setTouched(t => [...t, step])
  }
  const patchSettings = (s: StorySettings, step = 3) => patch({ settings: s }, step)
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const smartPick = () => patch({ photoIds: autoSelectPhotos(photos, checkins, Math.min(AUTO_PICK, limits.maxPhotos)), coverPhotoId: null }, 2)

  /** 切换步骤：桌面滚动到对应卡片；移动端只换显示的那一步，步骤导航被滚出屏幕时拉回来 */
  function goStep(id: string) {
    setActiveStep(id)
    if (!mobile) { scrollTo(id); return }
    requestAnimationFrame(() => {
      const nav = document.querySelector<HTMLElement>('.vs-layout .vs-steps')
      if (!nav) return
      // 平板是吸顶的 workspace-topbar，手机是吸顶的 m-topbar：让出当前可见的那一条
      const offset = Math.max(0, ...Array.from(document.querySelectorAll<HTMLElement>('.workspace-topbar, .m-topbar'))
        .filter(bar => getComputedStyle(bar).position === 'sticky' && getComputedStyle(bar).display !== 'none')
        .map(bar => bar.getBoundingClientRect().bottom))
      const top = nav.getBoundingClientRect().top
      if (top < offset + 4) window.scrollBy({ top: top - offset - 8, behavior: 'smooth' })
    })
  }

  async function reloadProjects(focus?: number) {
    const list = await videoApi.list(tripId)
    setProjects(list)
    if (focus !== undefined) setFocusedId(focus)
  }

  /** 保存草稿：第一次创建草稿项目，之后更新同一个草稿 */
  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setActionError('')
    try {
      const saved = editingId ? await videoApi.update(editingId, draft) : await videoApi.create(tripId, draft)
      setEditingId(saved.id)
      setSavedKey(JSON.stringify(draft))
      setSavedAt(new Date())
      await reloadProjects(saved.id)
      setToast('草稿已保存')
    } catch (e) {
      setActionError(friendly(e))
    } finally {
      setSaving(false)
    }
  }

  async function generate() {
    // submitLock：连续点两下时第二次点击还看不到 submitting 的新值，用 ref 同步拦住重复提交
    if (!draft || blocker || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setActionError('')
    let id = editingId
    try {
      if (id) {
        await videoApi.update(id, draft)
      } else {
        const created = await videoApi.create(tripId, draft)
        id = created.id
        setEditingId(created.id) // 生成失败时留下的是草稿，下次直接更新它，不会重复创建
      }
      await videoApi.render(id)
      setEditingId(null)
      setSavedKey('')
      setSubmitted(true)
      await reloadProjects(id)
      setToast(mobile ? '已开始生成，进度会实时显示在下方' : '已开始生成，进度会实时显示在右侧')
      scrollTo('vs-latest')
    } catch (e) {
      setActionError(friendly(e))
      if (id) await reloadProjects(id).catch(() => {})
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  async function run(id: number, fn: () => Promise<unknown>, done?: string) {
    setBusyId(id)
    setActionError('')
    try {
      await fn()
      if (done) setToast(done)
    } catch (e) {
      setActionError(friendly(e))
    } finally {
      setBusyId(null)
    }
  }

  const actions: ProjectActions = {
    onRender: id => { void run(id, async () => { await videoApi.render(id); await reloadProjects(id) }, '已进入生成队列') },
    onEdit: p => {
      const next: VideoDraft = {
        templateCode: p.templateCode,
        aspectRatio: p.aspectRatio,
        duration: p.duration,
        quality: p.quality,
        ...draftMusic(selectionOf(p)),
        coverPhotoId: p.coverPhotoId && photosById.has(p.coverPhotoId) ? p.coverPhotoId : null,
        photoIds: p.photoIds.filter(id => photosById.has(id)),
        settings: { ...defaultSettings(), ...p.settings, segments: p.settings?.segments ?? [], visualStyle: p.settings?.visualStyle ?? 'NATURAL' }
      }
      setDraft(next)
      setMusicTouched(true)
      const isDraft = p.status === 'DRAFT'
      setEditingId(isDraft ? p.id : null)
      setSavedKey(isDraft ? JSON.stringify(next) : '')
      setSavedAt(isDraft ? utcDate(p.updatedAt ?? p.createdAt) : null)
      setTouched([1, 2, 3, 4])
      setDemoTemplate(null)
      void refreshPreview(next)
      setToast(isDraft ? `已载入草稿「${p.name}」，生成时会更新这个草稿` : `已载入「${p.name}」的设置，生成时会创建新版本`)
      if (mobile) { setActiveStep('vs-step-1'); scrollTo('vs-preview') } else scrollTo('vs-step-1')
    },
    onDelete: p => {
      if (!window.confirm(`删除「${p.name || '旅行视频'}」？删除后无法恢复。`)) return
      void run(p.id, async () => {
        await videoApi.remove(p.id)
        if (editingId === p.id) { setEditingId(null); setSavedKey('') }
        const list = await videoApi.list(tripId)
        setProjects(list)
        if (focusedId === p.id) setFocusedId(list[0]?.id ?? null)
      }, '已删除')
    },
    onShare: p => { void (async () => {
      if (!isPlayable(p)) return
      const url = new URL(p.outputUrl!, window.location.href).toString()
      try {
        if (navigator.share) await navigator.share({ title: p.name || '我的旅行视频', text: '用旅迹 TabiTrace 生成的旅行视频', url })
        else { await navigator.clipboard.writeText(url); setToast('视频链接已复制') }
      } catch { /* 用户取消分享 */ }
    })() },
    onDuplicate: id => { void run(id, async () => { const copy = await videoApi.duplicate(id); await reloadProjects(copy.id) }, '已复制为新草稿') },
    onFocus: id => { setFocusedId(id); scrollTo('vs-latest') }
  }

  function applySuggestion(s: Suggestion) {
    if (!draft || !s.action) return
    if (s.action.autopick) { smartPick(); setToast('已按精选与时间补充素材'); return }
    const remove = new Set(s.action.remove ?? [])
    patch({ photoIds: draft.photoIds.filter(id => !remove.has(id)), coverPhotoId: draft.coverPhotoId && remove.has(draft.coverPhotoId) ? null : draft.coverPhotoId }, 2)
    setToast(`已移除 ${remove.size} 张相似照片`)
  }

  // ── 不能生成的原因（前端先提示，按钮直接禁用；后端还会再校验一次）──
  const template = templates.find(t => t.code === draft?.templateCode)
  const scenesNow = storyboard ? applySegments(storyboard.scenes, draft?.settings.segments ?? []) : []
  const blocker = !draft ? '' :
    photos.length === 0 ? '这趟旅行还没有照片，先上传几张照片' :
    draft.photoIds.length === 0 ? '请至少选择一张照片' :
    draft.photoIds.length > limits.maxPhotos ? `最多选择 ${limits.maxPhotos} 张照片` :
    plan === 'FREE' && template?.plan === 'PRO' ? `「${template.name}」是 Trip Pro 模板，请换成「旅行日记」` :
    !limits.durations.includes(draft.duration) ? `当前方案不支持 ${draft.duration} 秒视频，请在「导出」里重新选择时长` :
    qualityRank(draft.quality) > qualityRank(limits.quality) ? `当前方案最高导出 ${limits.quality.toUpperCase()}，请在「导出」里重新选择清晰度` :
    selectionProblem(selectionOf(draft), { music, musicReady: musicStatus === 'ready', plan, mine: mine.library }) ||
    (storyboard && !dirty && !scenesNow.some(s => s.type === 'PLACE' && s.enabled) ? '分镜里至少要保留一个照片段落' : '')

  const tip = useMemo(() => (draft ? suggestion(draft.photoIds, photosById, checkinsById, draft.duration, photos.length) : null), [draft, photosById, checkinsById, photos.length])

  // ── 渲染 ──
  if (loading) {
    return (
      <main><SiteHeader />
        <PageContainer variant="wide" className="vs-page">
          <div className="skeleton" style={{ height: 140, borderRadius: 18 }} />
          <div className="vs-layout" style={{ marginTop: 20 }}><div className="skeleton" style={{ height: 640, borderRadius: 18 }} /><div className="skeleton" style={{ height: 640, borderRadius: 18 }} /></div>
        </PageContainer>
      </main>
    )
  }

  if (loadError || !trip || !draft) {
    return (
      <main><SiteHeader />
        <PageContainer variant="wide" className="vs-page">
          <div className="vs-card vs-load-error">
            <TriangleAlert className="text-warm" />
            <p>Travel Story 加载失败</p>
            <small>{loadError || '旅行不存在或已被删除'}</small>
            <div>
              <button className="vs-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
              <Link href="/trips" className="vs-btn">返回我的旅程</Link>
            </div>
          </div>
        </PageContainer>
      </main>
    )
  }

  const musicSel = selectionOf(draft)
  const musicName = selectionLabel(musicSel, music, mine.library?.items ?? null)
  const musicVolume = draft.settings.musicVolume ?? DEFAULT_MUSIC_VOLUME
  const musicContext: MusicContext = {
    templateCode: draft.templateCode, destination: `${trip.destinationName ?? ''} ${trip.city ?? ''}`, duration: draft.duration,
    photoHours: photoHours(draft.photoIds, photos), photoCount: draft.photoIds.length, plan,
    templateDefault: templates.find(x => x.code === draft.templateCode)?.recommendedMusic ?? null
  }
  const style = styleOf(draft.settings.visualStyle)
  const coverPhoto = photosById.get(draft.coverPhotoId ?? draft.photoIds[0])
  const coverUrl = (coverPhoto ? photoMedium(coverPhoto) : undefined) ?? trip.coverImage ?? undefined
  const places = placeCount(draft.photoIds, photosById)
  const quality = draft.quality.toUpperCase()
  const totalSeconds = storyboard && !dirty ? storyboard.totalDuration : draft.duration
  const saveState = submitting ? '正在提交生成…'
    : editingId && savedKey === draftKey ? `草稿已保存${savedAt ? ` · ${hhmm(savedAt)}` : ''}`
    : editingId ? '有未保存的修改'
    : '尚未保存草稿'

  const steps: StepItem[] = [
    { id: 'vs-step-1', label: '模板', done: Boolean(template) },
    { id: 'vs-step-2', label: '素材', done: draft.photoIds.length > 0 },
    { id: 'vs-step-3', label: '风格', done: touched.includes(3) },
    { id: 'vs-step-4', label: mobile ? '导出' : '设置', done: touched.includes(4) },
    { id: 'vs-step-5', label: '生成', done: submitted }
  ]
  const stepIndex = Math.max(0, STEP_IDS.indexOf(activeStep))
  const current = (id: string) => mobile && activeStep === id

  const stepNav = <StudioSteps steps={steps} active={activeStep} onJump={goStep} />
  const alert = actionError && (
    <div className="vs-alert" role="alert">
      <TriangleAlert size={15} /> {actionError}
      <button type="button" onClick={() => setActionError('')} aria-label="关闭">×</button>
    </div>
  )
  const musicPicker = (
    <MusicSelector
      music={music} status={musicStatus} onRetry={() => void retryMusic()} selection={musicSel} plan={plan}
      context={musicContext} volume={musicVolume}
      onVolume={v => patchSettings({ ...draft.settings, musicVolume: v })}
      onChange={sel => { setMusicTouched(true); patch(draftMusic(sel), 3) }} />
  )

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="wide" className={`vs-page${mobile ? ' is-mobile' : ''}`}>
        <header className="vs-hero">
          <div className="vs-hero-text">
            <p className="vs-eyebrow">TRAVEL STORY · AI VIDEO STUDIO</p>
            <h1>{trip.title}</h1>
            <p>把照片、地点与旅途片段，<br />变成一支值得反复观看的旅行故事。</p>
          </div>
          <div className="vs-hero-actions">
            <span className={`vs-save-state${editingId && savedKey === draftKey ? ' is-saved' : ''}`}>
              {editingId && savedKey === draftKey && <Check size={13} />}{saveState}
            </span>
            <div>
              <button type="button" className="vs-btn" onClick={() => void saveDraft()} disabled={saving || submitting}><Save size={14} /> {saving ? '保存中…' : '保存草稿'}</button>
              {mobile
                ? <button type="button" className="vs-btn" onClick={() => scrollTo('vs-videos')}><Film size={14} /> 我的视频 · {projects.length}</button>
                : <button type="button" className="vs-btn is-primary" onClick={() => scrollTo('vs-step-5')}><Sparkles size={14} /> 生成视频</button>}
            </div>
          </div>
        </header>
        <LiveTripSubnav tripId={tripId} />

        {!mobile && stepNav}
        {!mobile && alert}

        <div className={`vs-layout${mobile ? ' is-stepper' : ''}`}>
          {mobile && stepNav}
          {mobile && alert}
          <div className="vs-main">
            <StudioStep id="vs-step-1" no={1} title="选择视频模板" sub="选择最适合这段旅程的叙事方式。" current={current('vs-step-1')}>
              <TemplatePicker
                templates={templates}
                value={draft.templateCode}
                plan={plan}
                cover={coverUrl}
                onChange={code => {
                  if (code === draft.templateCode) return
                  // 用户还没亲自选过音乐时，切换模板一起换成新模板的推荐音乐；自己选过的音乐保持不变。照片从不因切换模板而改变
                  const nextTpl = templates.find(x => x.code === code)
                  const nextRec = musicTouched ? null : defaultMusicFor(music, { ...musicContext, templateCode: code, templateDefault: nextTpl?.recommendedMusic ?? null })
                  const follow = nextRec != null && nextRec !== draft.musicCode
                  patch(follow ? { templateCode: code, ...draftMusic({ source: 'SYSTEM', code: nextRec }) } : { templateCode: code }, 1)
                  setToast(follow
                    ? `已切换到「${nextTpl?.name ?? code}」，背景音乐换成了推荐的「${music.find(m => m.code === nextRec)?.name}」，已选照片不变`
                    : `已切换到「${nextTpl?.name ?? code}」，已选照片和背景音乐保持不变`)
                }}
                onPreview={async code => {
                  if (!storyboard) await refreshPreview()
                  setDemoTemplate(code)
                  scrollTo('vs-preview')
                }}
              />
            </StudioStep>

            <StudioStep id="vs-step-2" no={2} title="选择旅行素材" sub="从你的旅行记录中挑选最值得进入故事的瞬间。" current={current('vs-step-2')}>
              <MaterialPicker
                tripId={tripId}
                photos={photos}
                checkins={checkins}
                selected={draft.photoIds}
                max={limits.maxPhotos}
                plan={plan}
                onChange={ids => patch({ photoIds: ids, coverPhotoId: draft.coverPhotoId && ids.includes(draft.coverPhotoId) ? draft.coverPhotoId : null }, 2)}
                onSmartPick={smartPick}
              />
              <ShotTimeline
                ids={draft.photoIds}
                photosById={photosById}
                checkinsById={checkinsById}
                cover={draft.coverPhotoId}
                totalSeconds={totalSeconds}
                mobile={mobile}
                onChange={ids => patch({ photoIds: ids, coverPhotoId: draft.coverPhotoId && ids.includes(draft.coverPhotoId) ? draft.coverPhotoId : null }, 2)}
                onCover={id => patch({ coverPhotoId: id }, 2)}
              />
            </StudioStep>

            <StudioStep id="vs-step-3" no={3} title="内容与风格" sub="决定视频里出现哪些信息，以及整支视频的色调与配乐。" current={current('vs-step-3')}>
              {mobile ? (
                <>
                  <div className="vs-subtabs" role="tablist" aria-label="内容与风格">
                    {CONTENT_TABS.map(([key, label]) => (
                      <button key={key} type="button" role="tab" aria-selected={contentTab === key} className={contentTab === key ? 'is-active' : ''} onClick={() => setContentTab(key)}>{label}</button>
                    ))}
                  </div>
                  {contentTab === 'music'
                    ? <MusicCard music={music} selection={musicSel} volume={musicVolume}
                        onVolume={v => patchSettings({ ...draft.settings, musicVolume: v })} onOpen={() => setMusicSheet(true)} />
                    : <ContentStyle section={contentTab} value={draft.settings} tripTitle={trip.title} cover={coverUrl} onChange={s => patchSettings(s)} />}
                </>
              ) : (
                <>
                  <ContentStyle value={draft.settings} tripTitle={trip.title} cover={coverUrl} onChange={s => patchSettings(s)} />
                  {musicPicker}
                </>
              )}
            </StudioStep>

            <StudioStep id="vs-step-4" no={4} title={mobile ? '导出设置' : '视频设置'} sub="比例、时长与清晰度。" current={current('vs-step-4')}>
              <VideoSpecs plan={plan} tiers={tiers} compact={mobile} aspectRatio={draft.aspectRatio} duration={draft.duration} quality={draft.quality} onChange={p => patch(p, 4)} />
            </StudioStep>

            <StudioStep id="vs-step-5" no={5} title="准备生成" sub="确认一下，就可以生成这支旅行视频了。" current={current('vs-step-5')}>
              <GeneratePanel
                items={[template?.name ?? draft.templateCode, `${draft.photoIds.length} 个旅行素材`, musicName, `${draft.duration} 秒`, draft.aspectRatio, quality, style.name]}
                compact={mobile}
                rows={[
                  ['模板', template?.name ?? draft.templateCode],
                  ['素材', `${draft.photoIds.length} 张照片 · ${places} 个地点${draft.coverPhotoId ? ' · 已设封面' : ''}`],
                  ['背景音乐', musicSel == null ? '无音乐' : `${musicName} · 音量 ${musicVolume}%`],
                  ['视频风格', style.name],
                  ['比例', draft.aspectRatio],
                  ['时长', `${draft.duration} 秒`],
                  ['画质', `${quality}${limits.watermark ? ' · 带水印' : ' · 无水印'}`]
                ]}
                blocker={blocker}
                busy={submitting}
                saving={saving}
                editingDraft={editingId !== null}
                onSave={() => void saveDraft()}
                onGenerate={() => void generate()}
                storyboard={
                  <VideoStoryboard
                    storyboard={storyboard}
                    segments={draft.settings.segments}
                    photosById={photosById}
                    dirty={dirty}
                    loading={previewLoading}
                    onChange={segments => patchSettings({ ...draft.settings, segments }, 5)}
                    onRefresh={() => void refreshPreview()}
                  />
                }
              />
            </StudioStep>
          </div>

          <aside className="vs-side">
            <PreviewPanel
              style={style.code}
              compact={mobile}
              title={draft.settings.title || trip.title}
              info={[
                ['模板', template?.name ?? draft.templateCode],
                ['比例', draft.aspectRatio],
                ['时长', `约 ${Math.round(totalSeconds)} 秒`],
                ['音乐', musicName]
              ]}
              aspectRatio={draft.aspectRatio}
              onAspect={r => patch({ aspectRatio: r }, 4)}
              storyboard={storyboard}
              photosById={photosById}
              templateCode={draft.templateCode}
              chips={[]}
              dirty={dirty}
              loading={previewLoading}
              error={previewError}
              demoTemplate={demoTemplate}
              onRefresh={() => void refreshPreview()}
              onDemoEnd={() => setDemoTemplate(null)}
            />
            {!mobile && (
              <ProjectSummary rows={[
                ['模板', template?.englishName ?? draft.templateCode],
                ['素材', `${draft.photoIds.length} 项`],
                ['地点', `${places} 个`],
                ['音乐', musicName],
                ['风格', style.name],
                ['时长', `${draft.duration} 秒`],
                ['比例', draft.aspectRatio],
                ['质量', `${quality}${limits.watermark ? ' · 水印' : ''}`]
              ]} />
            )}
            {(!mobile || activeStep === 'vs-step-2') && <SmartSuggestion suggestion={tip} onApply={applySuggestion} />}
            {(!mobile || focused) && (
              <LatestVideo
                project={focused}
                template={templates.find(t => t.code === focused?.templateCode)}
                cover={focused ? mediumOf(photosById.get(focused.coverPhotoId ?? focused.photoIds[0])) : undefined}
                busy={focused ? busyId === focused.id : false}
                actions={actions}
                playSignal={playSignal}
              />
            )}
          </aside>
        </div>

        <MyVideos
          projects={named}
          templates={templates}
          coverOf={p => thumbOf(photosById.get(p.coverPhotoId ?? p.photoIds[0]))}
          focusedId={focused?.id ?? null}
          busyId={busyId}
          mobile={mobile}
          actions={actions}
          onPlay={id => { setFocusedId(id); setPlaySignal(n => n + 1) }}
        />

        {mobile && (
          <div className={`vs-actionbar${typing ? ' is-hidden' : ''}`} role="toolbar" aria-label="创作步骤操作">
            {stepIndex === 4 && blocker && <p className="vs-actionbar-note"><TriangleAlert size={12} /> {blocker}</p>}
            <div>
              {stepIndex < 4 ? (
                <>
                  <button type="button" className="vs-btn" disabled={stepIndex === 0} onClick={() => goStep(STEP_IDS[stepIndex - 1])}><ChevronLeft size={16} /> 上一步</button>
                  <button type="button" className="vs-btn is-primary" onClick={() => goStep(STEP_IDS[stepIndex + 1])}>下一步 · {steps[stepIndex + 1].label} <ChevronRight size={16} /></button>
                </>
              ) : (
                <>
                  <button type="button" className="vs-btn" onClick={() => goStep(STEP_IDS[3])} disabled={submitting}><ChevronLeft size={16} /> 返回修改</button>
                  <button type="button" className="vs-btn is-primary" onClick={() => void generate()} disabled={Boolean(blocker) || submitting} aria-busy={submitting}>
                    <Sparkles size={16} /> {submitting ? '正在提交…' : '生成旅行视频'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {mobile && (
          <BottomSheet open={musicSheet} title="更换背景音乐" onClose={() => setMusicSheet(false)}>
            {musicPicker}
            <div className="vs-sheet-foot">
              <button type="button" className="vs-btn is-primary" onClick={() => setMusicSheet(false)}>完成 · {musicName}</button>
            </div>
          </BottomSheet>
        )}

        {toast && <div className="vs-toast" role="status">{toast}</div>}
      </PageContainer>
    </main>
  )
}
