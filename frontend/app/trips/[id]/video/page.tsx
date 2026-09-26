'use client'

/**
 * Travel Story · AI 旅行视频制作工作台。
 * 左侧五步创作（模板 → 素材 → 内容与风格 → 视频设置 → 生成），右侧 sticky 实时预览与项目信息，底部是我的视频。
 * 页面只负责编排状态；模板、音乐、分镜、FREE / PRO 规则和渲染进度全部来自后端。
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RefreshCcw, Save, Sparkles, TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LiveTripSubnav } from '@/components/trip/LiveTripSubnav'
import { VideoStoryboard, applySegments } from '@/components/video/VideoStoryboard'
import { StudioStep } from '@/components/video/studio/StudioStep'
import { StudioSteps, useActiveStep, type StepItem } from '@/components/video/studio/StudioSteps'
import { TemplatePicker } from '@/components/video/studio/TemplatePicker'
import { MaterialPicker } from '@/components/video/studio/MaterialPicker'
import { ShotTimeline } from '@/components/video/studio/ShotTimeline'
import { ContentStyle } from '@/components/video/studio/ContentStyle'
import { MusicPicker } from '@/components/video/studio/MusicPicker'
import { VideoSpecs } from '@/components/video/studio/VideoSpecs'
import { GeneratePanel } from '@/components/video/studio/GeneratePanel'
import { PreviewPanel } from '@/components/video/studio/PreviewPanel'
import { ProjectSummary } from '@/components/video/studio/ProjectSummary'
import { SmartSuggestion } from '@/components/video/studio/SmartSuggestion'
import { LatestVideo, type ProjectActions } from '@/components/video/studio/LatestVideo'
import { MyVideos } from '@/components/video/studio/MyVideos'
import { ApiError } from '@/services/api'
import { tripApi, type CheckinView, type PhotoView, type TripView } from '@/services/tabitrace-api'
import { videoApi } from '@/services/video'
import type { Plan, StorySettings, Storyboard, VideoDraft, VideoMusic, VideoProject, VideoTemplate } from '@/types/video'
import { PLAN_LIMITS, isPlayable, isRunning, utcDate } from '@/utils/video-status'
import { autoSelectPhotos } from '@/utils/video-autoselect'
import { placeCount, styleOf, suggestion, type Suggestion } from '@/utils/video-studio'

/** 自动挑选时最多取的张数：30 秒视频里每张约 2 秒最舒服，超过的可以手动加选 */
const AUTO_PICK = 12
const STEP_IDS = ['vs-step-1', 'vs-step-2', 'vs-step-3', 'vs-step-4', 'vs-step-5']

const defaultSettings = (plan: Plan): StorySettings => ({
  title: null,
  endingText: null,
  showTitle: true,
  showDate: true,
  showPlaceNames: true,
  showCheckinText: true,
  showWeather: true,
  showStats: true,
  showAchievements: true,
  showEnding: true,
  mapMode: plan === 'PRO' ? 'FULL' : 'SIMPLE',
  segments: [],
  visualStyle: 'NATURAL'
})

/** 预览是否过期只看会影响分镜的设置；视觉风格只调色，网页预览实时套用，不需要重新编排 */
const storyKey = (d: VideoDraft) => JSON.stringify({ ...d, settings: { ...d.settings, visualStyle: null } })
const friendly = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : '操作失败，请稍后再试')
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function TravelStoryPage() {
  const params = useParams<{ id: string }>()
  const tripId = Number(params.id)

  // ── 数据 ──
  const [trip, setTrip] = useState<TripView | null>(null)
  const [photos, setPhotos] = useState<PhotoView[]>([])
  const [checkins, setCheckins] = useState<CheckinView[]>([])
  const [projects, setProjects] = useState<VideoProject[]>([])
  const [templates, setTemplates] = useState<VideoTemplate[]>([])
  const [music, setMusic] = useState<VideoMusic[]>([])
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

  // ── 项目 ──
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [playSignal, setPlaySignal] = useState(0)
  const [toast, setToast] = useState('')
  const [actionError, setActionError] = useState('')
  const [activeStep, setActiveStep] = useActiveStep(STEP_IDS)

  const plan: Plan = trip?.planType === 'PRO' ? 'PRO' : 'FREE'
  const limits = PLAN_LIMITS[plan]
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
      const [t, ps, cs, vs, tpls, ms] = await Promise.all([
        tripApi.get(tripId), tripApi.photos(tripId), tripApi.checkins(tripId),
        videoApi.list(tripId), videoApi.templates(), videoApi.music()
      ])
      setTrip(t); setPhotos(ps); setCheckins(cs); setProjects(vs); setTemplates(tpls); setMusic(ms)
      setFocusedId(vs[0]?.id ?? null)
      const p: Plan = t.planType === 'PRO' ? 'PRO' : 'FREE'
      const initial: VideoDraft = {
        templateCode: 'JOURNAL',
        aspectRatio: '9:16',
        duration: 30,
        quality: PLAN_LIMITS[p].quality,
        musicCode: ms.some(m => m.code === 'WARM_JOURNEY') ? 'WARM_JOURNEY' : 'NONE',
        coverPhotoId: null,
        photoIds: autoSelectPhotos(ps, cs, Math.min(AUTO_PICK, PLAN_LIMITS[p].maxPhotos)),
        settings: defaultSettings(p)
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

  // 有任务在排队 / 生成时轮询后端真实状态
  useEffect(() => {
    if (!running) return
    const id = setInterval(async () => {
      try { setProjects(await videoApi.list(tripId)) } catch { /* 下一次轮询重试 */ }
    }, 1500)
    return () => clearInterval(id)
  }, [running, tripId])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  /** step：这次修改属于第几步，用来点亮步骤导航里的小勾 */
  const patch = (p: Partial<VideoDraft>, step?: number) => {
    setDraft(d => (d ? { ...d, ...p } : d))
    if (step && !touched.includes(step)) setTouched(t => [...t, step])
  }
  const patchSettings = (s: StorySettings, step = 3) => patch({ settings: s }, step)
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const smartPick = () => patch({ photoIds: autoSelectPhotos(photos, checkins, Math.min(AUTO_PICK, limits.maxPhotos)), coverPhotoId: null }, 2)

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
    if (!draft || blocker) return
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
      setToast('已开始生成，进度会实时显示在右侧')
      scrollTo('vs-latest')
    } catch (e) {
      setActionError(friendly(e))
      if (id) await reloadProjects(id).catch(() => {})
    } finally {
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
    onRender: id => run(id, async () => { await videoApi.render(id); await reloadProjects(id) }, '已进入生成队列'),
    onEdit: p => {
      const next: VideoDraft = {
        templateCode: p.templateCode,
        aspectRatio: p.aspectRatio,
        duration: p.duration,
        quality: p.quality,
        musicCode: p.musicCode,
        coverPhotoId: p.coverPhotoId && photosById.has(p.coverPhotoId) ? p.coverPhotoId : null,
        photoIds: p.photoIds.filter(id => photosById.has(id)),
        settings: { ...defaultSettings(plan), ...p.settings, segments: p.settings?.segments ?? [], visualStyle: p.settings?.visualStyle ?? 'NATURAL' }
      }
      setDraft(next)
      const isDraft = p.status === 'DRAFT'
      setEditingId(isDraft ? p.id : null)
      setSavedKey(isDraft ? JSON.stringify(next) : '')
      setSavedAt(isDraft ? utcDate(p.updatedAt ?? p.createdAt) : null)
      setTouched([1, 2, 3, 4])
      setDemoTemplate(null)
      void refreshPreview(next)
      setToast(isDraft ? `已载入草稿「${p.name}」，生成时会更新这个草稿` : `已载入「${p.name}」的设置，生成时会创建新版本`)
      scrollTo('vs-step-1')
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
    onShare: async p => {
      if (!isPlayable(p)) return
      const url = new URL(p.outputUrl!, window.location.href).toString()
      try {
        if (navigator.share) await navigator.share({ title: p.name || '我的旅行视频', text: '用旅迹 TabiTrace 生成的旅行视频', url })
        else { await navigator.clipboard.writeText(url); setToast('视频链接已复制') }
      } catch { /* 用户取消分享 */ }
    },
    onDuplicate: id => run(id, async () => { const copy = await videoApi.duplicate(id); await reloadProjects(copy.id) }, '已复制为新草稿'),
    onFocus: id => { setFocusedId(id); scrollTo('vs-latest') }
  }

  function applySuggestion(s: Suggestion) {
    if (!draft || !s.action) return
    if (s.action.autopick) { smartPick(); setToast('已按精选与时间补充素材'); return }
    const remove = new Set(s.action.remove ?? [])
    patch({ photoIds: draft.photoIds.filter(id => !remove.has(id)), coverPhotoId: draft.coverPhotoId && remove.has(draft.coverPhotoId) ? null : draft.coverPhotoId }, 2)
    setToast(`已移除 ${remove.size} 张相似照片`)
  }

  // ── 不能生成的原因（前端先提示；后端还会再校验一次）──
  const template = templates.find(t => t.code === draft?.templateCode)
  const scenesNow = storyboard ? applySegments(storyboard.scenes, draft?.settings.segments ?? []) : []
  const blocker = !draft ? '' :
    photos.length === 0 ? '这趟旅行还没有照片，先上传几张照片' :
    draft.photoIds.length === 0 ? '请至少选择一张照片' :
    draft.photoIds.length > limits.maxPhotos ? `最多选择 ${limits.maxPhotos} 张照片` :
    plan === 'FREE' && template?.plan === 'PRO' ? `「${template.name}」是 Trip Pro 模板，请换成「旅行日记」` :
    storyboard && !dirty && !scenesNow.some(s => s.type === 'PLACE' && s.enabled) ? '分镜里至少要保留一个照片段落' : ''

  const tip = useMemo(() => (draft ? suggestion(draft.photoIds, photosById, checkinsById, draft.duration, photos.length) : null), [draft, photosById, checkinsById, photos.length])

  // ── 渲染 ──
  if (loading) {
    return (
      <main><SiteHeader />
        <section className="vs-page">
          <div className="skeleton" style={{ height: 140, borderRadius: 18 }} />
          <div className="vs-layout" style={{ marginTop: 20 }}><div className="skeleton" style={{ height: 640, borderRadius: 18 }} /><div className="skeleton" style={{ height: 640, borderRadius: 18 }} /></div>
        </section>
      </main>
    )
  }

  if (loadError || !trip || !draft) {
    return (
      <main><SiteHeader />
        <section className="vs-page">
          <div className="vs-card vs-load-error">
            <TriangleAlert className="text-warm" />
            <p>Travel Story 加载失败</p>
            <small>{loadError || '旅行不存在或已被删除'}</small>
            <div>
              <button className="vs-btn is-primary" onClick={() => void load()}><RefreshCcw size={14} /> 重新加载</button>
              <Link href="/trips" className="vs-btn">返回我的旅程</Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const musicName = music.find(m => m.code === draft.musicCode)?.name ?? '无音乐'
  const style = styleOf(draft.settings.visualStyle)
  const coverUrl = photosById.get(draft.coverPhotoId ?? draft.photoIds[0])?.imageUrl ?? trip.coverImage ?? undefined
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
    { id: 'vs-step-4', label: '设置', done: touched.includes(4) },
    { id: 'vs-step-5', label: '生成', done: submitted }
  ]

  return (
    <main>
      <SiteHeader />
      <section className="vs-page">
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
              <button type="button" className="vs-btn is-primary" onClick={() => scrollTo('vs-step-5')}><Sparkles size={14} /> 生成视频</button>
            </div>
          </div>
        </header>
        <LiveTripSubnav tripId={tripId} />

        <StudioSteps steps={steps} active={activeStep} onJump={id => { setActiveStep(id); scrollTo(id) }} />

        {actionError && (
          <div className="vs-alert" role="alert">
            <TriangleAlert size={15} /> {actionError}
            <button type="button" onClick={() => setActionError('')} aria-label="关闭">×</button>
          </div>
        )}

        <div className="vs-layout">
          <div className="vs-main">
            <StudioStep id="vs-step-1" no={1} title="选择视频模板" sub="选择最适合这段旅程的叙事方式。">
              <TemplatePicker
                templates={templates}
                value={draft.templateCode}
                plan={plan}
                cover={coverUrl}
                onChange={code => patch({ templateCode: code }, 1)}
                onPreview={async code => {
                  if (!storyboard) await refreshPreview()
                  setDemoTemplate(code)
                  scrollTo('vs-preview')
                }}
              />
            </StudioStep>

            <StudioStep id="vs-step-2" no={2} title="选择旅行素材" sub="从你的旅行记录中挑选最值得进入故事的瞬间。">
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
                onChange={ids => patch({ photoIds: ids, coverPhotoId: draft.coverPhotoId && ids.includes(draft.coverPhotoId) ? draft.coverPhotoId : null }, 2)}
                onCover={id => patch({ coverPhotoId: id }, 2)}
              />
            </StudioStep>

            <StudioStep id="vs-step-3" no={3} title="内容与风格" sub="决定视频里出现哪些信息，以及整支视频的色调与配乐。">
              <ContentStyle value={draft.settings} plan={plan} tripTitle={trip.title} cover={coverUrl} onChange={s => patchSettings(s)} />
              <MusicPicker music={music} value={draft.musicCode} plan={plan} templateCode={draft.templateCode} onChange={code => patch({ musicCode: code }, 3)} />
            </StudioStep>

            <StudioStep id="vs-step-4" no={4} title="视频设置" sub="比例、时长与清晰度。">
              <VideoSpecs plan={plan} aspectRatio={draft.aspectRatio} duration={draft.duration} quality={draft.quality} onChange={p => patch(p, 4)} />
            </StudioStep>

            <StudioStep id="vs-step-5" no={5} title="准备生成" sub="确认一下，就可以生成这支旅行视频了。">
              <GeneratePanel
                items={[template?.name ?? draft.templateCode, `${draft.photoIds.length} 个旅行素材`, musicName, `${draft.duration} 秒`, draft.aspectRatio, quality, style.name]}
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
            <ProjectSummary rows={[
              ['模板', template?.englishName ?? draft.templateCode],
              ['素材', `${draft.photoIds.length} 项`],
              ['地点', `${places} 个`],
              ['音乐', musicName],
              ['风格', style.name],
              ['时长', `${draft.duration} 秒`],
              ['比例', draft.aspectRatio],
              ['质量', `${quality}${plan === 'FREE' ? ' · 水印' : ''}`]
            ]} />
            <SmartSuggestion suggestion={tip} onApply={applySuggestion} />
            <LatestVideo
              project={focused}
              template={templates.find(t => t.code === focused?.templateCode)}
              cover={focused ? photosById.get(focused.coverPhotoId ?? focused.photoIds[0])?.imageUrl : undefined}
              busy={focused ? busyId === focused.id : false}
              actions={actions}
              playSignal={playSignal}
            />
          </aside>
        </div>

        <MyVideos
          projects={named}
          templates={templates}
          coverOf={p => photosById.get(p.coverPhotoId ?? p.photoIds[0])?.imageUrl}
          focusedId={focused?.id ?? null}
          busyId={busyId}
          actions={actions}
          onPlay={id => { setFocusedId(id); setPlaySignal(n => n + 1) }}
        />

        {toast && <div className="vs-toast" role="status">{toast}</div>}
      </section>
    </main>
  )
}
