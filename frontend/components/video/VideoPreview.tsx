'use client'

/**
 * 右侧预览：按后端分镜逐段播放，模拟成片的版式与转场；画面比例跟随当前选择（9:16 / 4:5 / 16:9）。
 * 这是网页模拟，最终效果以生成的 MP4 为准；设置变化后提示重新预览，不自动冒充最新结果。
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import type { Scene, Storyboard } from '@/types/video'
import type { PhotoView } from '@/services/tabitrace-api'
import { timecode } from '@/utils/video-status'
import { photoMedium } from '@/utils/photo-variants'

/** 预览只播放这几类段落（旧版本冻结的分镜里可能还有已移除的地图段落，直接跳过） */
const PLAYABLE = new Set(['OPENING', 'PLACE', 'ENDING'])

type Chip = { label: string; value: string }

/** 10 秒模板预览：从当前分镜里取开场、两个地点、结尾，各 2.5 秒左右。 */
export function makeTemplateDemo(sb: Storyboard, templateCode: string): Storyboard {
  const on = sb.scenes.filter(s => s.enabled && s.duration > 0)
  const pick: Scene[] = []
  const opening = on.find(s => s.type === 'OPENING')
  const places = on.filter(s => s.type === 'PLACE').slice(0, 2)
  const ending = on.find(s => s.type === 'ENDING')
  if (opening) pick.push(opening)
  places.forEach(p => pick.push({ ...p, photoIds: p.photoIds.slice(0, 1) }))
  if (ending) pick.push(ending)
  const each = pick.length ? 10 / pick.length : 10
  let start = 0
  const scenes = pick.map(s => {
    const scene = { ...s, start, duration: each, meta: { ...s.meta, shots: s.type === 'PLACE' ? [each] : s.meta.shots } }
    start += each
    return scene
  })
  return { ...sb, templateCode, totalDuration: 10, scenes }
}

export function VideoPreview({
  storyboard, photosById, templateCode, chips, dirty, loading, error, demoTemplate, onRefresh, onDemoEnd, aspectRatio
}: {
  storyboard: Storyboard | null
  /** 当前选择的成片比例（切换后立即按新比例显示，不等分镜刷新）；缺省时按分镜分辨率 */
  aspectRatio?: string
  photosById: Map<number, PhotoView>
  templateCode: string
  chips: Chip[]
  dirty: boolean
  loading: boolean
  error: string
  demoTemplate: string | null
  onRefresh: () => void
  onDemoEnd: () => void
}) {
  const sb = useMemo(() => (storyboard && demoTemplate ? makeTemplateDemo(storyboard, demoTemplate) : storyboard), [storyboard, demoTemplate])
  const tpl = (demoTemplate || templateCode).toLowerCase()
  const scenes = useMemo(() => sb?.scenes.filter(s => s.enabled && s.duration > 0 && PLAYABLE.has(s.type)) ?? [], [sb])
  const total = scenes.reduce((a, s) => a + s.duration, 0)

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const endedRef = useRef(false)

  // 新分镜到来：回到开头；模板预览自动播放
  useEffect(() => { setT(0); endedRef.current = false; setPlaying(Boolean(demoTemplate)) }, [sb, demoTemplate])

  // 预览时钟：按真实经过的时间推进（约 30fps），不依赖 requestAnimationFrame，页面暂停绘制时也不会卡住
  useEffect(() => {
    if (!playing || total <= 0) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      setT(prev => Math.min(total, prev + dt))
    }, 33)
    return () => window.clearInterval(id)
  }, [playing, total])

  useEffect(() => {
    if (total > 0 && t >= total && !endedRef.current) {
      endedRef.current = true
      setPlaying(false)
      if (demoTemplate) onDemoEnd()
    }
  }, [t, total, demoTemplate, onDemoEnd])

  // 当前段落与镜头
  let acc = 0
  let current: Scene | null = null
  let sceneStart = 0
  for (const s of scenes) {
    if (t < acc + s.duration || s === scenes[scenes.length - 1]) { current = s; sceneStart = acc; break }
    acc += s.duration
  }
  const local = Math.max(0, t - sceneStart)
  // 预览画面比例：优先用当前选择的比例，其次是分镜分辨率（例如 1920×1080）
  const [rw, rh] = (sb?.resolution ?? '1080×1920').split('×').map(Number)
  const ratio = aspectRatio === '16:9' ? 9 / 16 : aspectRatio === '4:5' ? 5 / 4 : aspectRatio === '9:16' ? 16 / 9 : rw > 0 && rh > 0 ? rh / rw : 16 / 9
  const ratioClass = ratio < 1 ? ' is-16x9' : ratio < 1.5 ? ' is-4x5' : ''
  let shot = 0
  if (current?.type === 'PLACE') {
    const shots = current.meta.shots?.length ? current.meta.shots : current.photoIds.map(() => current!.duration / Math.max(1, current!.photoIds.length))
    let sum = 0
    for (let i = 0; i < shots.length; i++) { sum += shots[i]; if (local < sum) { shot = i; break } shot = i }
  }

  const transition = tpl === 'city'
    ? { initial: { opacity: 0, x: '18%' }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: '-18%' }, transition: { duration: 0.3 } }
    : tpl === 'minimal'
      ? { initial: { opacity: 0, scale: 1.03 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 }, transition: { duration: 0.9 } }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.6 } }

  const photo = (id?: number) => { const p = id ? photosById.get(id) : undefined; return p ? photoMedium(p) : undefined }

  return (
    <div className="ts-preview">
      <div className="ts-preview-chips">
        {chips.map(c => <span key={c.label}><small>{c.label}</small>{c.value}</span>)}
      </div>

      <div className={`ts-phone tpl-${tpl}${ratioClass}`}>
        <div className="ts-screen">
          {current ? (
            <AnimatePresence mode="sync" initial={false}>
              <motion.div key={`${current.key}-${shot}`} className="ts-slide" {...transition}>
                <Slide scene={current} shot={shot} photo={photo} watermark={Boolean(sb?.watermark)} tpl={tpl} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="ts-slide ts-slide-empty">
              <Sparkles size={22} />
              <p>{loading ? '正在按旅行数据编排分镜…' : '选好照片后生成预览，这里会按分镜播放一遍。'}</p>
              {!loading && <button type="button" className="warm-button" onClick={onRefresh}>生成预览</button>}
            </div>
          )}

          {demoTemplate && <div className="ts-demo-badge">10 秒风格预览 · {demoTemplate}</div>}
          {!demoTemplate && dirty && storyboard && (
            <div className="ts-dirty">
              <p>设置已变化，请重新生成预览。</p>
              <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 重新预览</button>
            </div>
          )}
          {error && <div className="ts-preview-error">{error}</div>}
        </div>
      </div>

      {current && (
        <div className="ts-player">
          <button type="button" onClick={() => { if (t >= total) { setT(0); endedRef.current = false } setPlaying(p => !p) }} aria-label={playing ? '暂停预览' : '播放预览'}>
            {playing ? <Pause size={15} /> : t >= total ? <RotateCcw size={15} /> : <Play size={15} />}
          </button>
          <div
            className="ts-player-bar"
            role="slider"
            aria-label="预览进度"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(t)}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect()
              setT(Math.max(0, Math.min(total, ((e.clientX - r.left) / r.width) * total)))
              endedRef.current = false
            }}
          >
            {scenes.map(s => <i key={s.key} style={{ width: `${(s.duration / total) * 100}%` }} />)}
            <span style={{ width: `${total ? (t / total) * 100 : 0}%` }} />
          </div>
          <em>{timecode(t)} / {timecode(total)}</em>
        </div>
      )}
      <p className="ts-preview-note">网页预览模拟分镜与转场，最终效果以生成的 MP4 为准。</p>
    </div>
  )
}

function Slide({ scene, shot, photo, watermark, tpl }: {
  scene: Scene
  shot: number
  photo: (id?: number) => string | undefined
  watermark: boolean
  tpl: string
}) {
  const wm = watermark ? <span className="ts-wm">旅迹 TabiTrace</span> : null

  if (scene.type === 'ENDING') {
    const bg = photo(scene.photoIds[0])
    return (
      <div className={`ts-s-ending${tpl === 'minimal' || !bg ? ' is-paper' : ''}`}>
        {bg && tpl !== 'minimal' && <img src={bg} alt="" />}
        <div>
          <b>{scene.title}</b>
          <span>{scene.subtitle}</span>
          {scene.meta.stats && <strong>{scene.meta.stats}</strong>}
          {scene.meta.endingText && <q>{scene.meta.endingText}</q>}
        </div>
        <footer><em>{scene.meta.tagline}</em><b>旅迹 TabiTrace</b></footer>
        {wm}
      </div>
    )
  }

  // OPENING / PLACE：照片镜头
  const src = photo(scene.photoIds[scene.type === 'PLACE' ? shot : 0])
  const isOpening = scene.type === 'OPENING'
  return (
    <div className={`ts-s-photo ${isOpening ? 'is-opening' : ''}`}>
      {src ? <img src={src} alt="" className={tpl === 'minimal' ? 'is-framed' : ''} /> : <div className="ts-s-nophoto" />}
      <div className="ts-s-caption">
        {isOpening && scene.meta.kicker && tpl !== 'city' && <small>{scene.meta.kicker}</small>}
        {isOpening && tpl === 'city' && scene.meta.destination && <strong>{scene.meta.destination}</strong>}
        <i className="ts-s-bar" />
        {scene.title && <b>{scene.title}</b>}
        {scene.subtitle && <span>{scene.subtitle}</span>}
        {!isOpening && scene.meta.note && (tpl === 'journal' || shot === 0) && <q>{scene.meta.note}</q>}
        {isOpening && tpl === 'journal' && scene.meta.destination && <em className="ts-s-pill">{scene.meta.destination}</em>}
      </div>
      {wm}
    </div>
  )
}
