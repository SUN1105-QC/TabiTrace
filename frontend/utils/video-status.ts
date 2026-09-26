/** 视频状态 / 渲染阶段 / 错误码 → 界面文案。状态全部来自后端，这里只做映射，不模拟进度。 */

import type { RenderStage, VideoProject, VideoStatus, Plan } from '@/types/video'

export const STATUS_LABEL: Record<VideoStatus, string> = {
  DRAFT: '草稿',
  QUEUED: '排队中',
  PROCESSING: '生成中',
  COMPLETED: '已完成',
  FAILED: '失败'
}

export const STATUS_TONE: Record<VideoStatus, 'muted' | 'info' | 'brand' | 'success' | 'danger'> = {
  DRAFT: 'muted',
  QUEUED: 'info',
  PROCESSING: 'brand',
  COMPLETED: 'success',
  FAILED: 'danger'
}

/** 展示给用户的五个阶段；UPLOADING 归入「正在导出 MP4」。 */
export const RENDER_STEPS: { key: RenderStage; label: string }[] = [
  { key: 'PREPARING', label: '正在准备素材' },
  { key: 'MAP', label: '正在生成地图动画' },
  { key: 'STORY', label: '正在生成旅行故事' },
  { key: 'MUSIC', label: '正在合成音乐' },
  { key: 'EXPORTING', label: '正在导出 MP4' }
]

export type StepState = 'done' | 'active' | 'todo'

/** 根据后端的 status + renderStage 推出每个阶段的完成情况。 */
export function stepStates(p: Pick<VideoProject, 'status' | 'renderStage'>): StepState[] {
  if (p.status === 'COMPLETED') return RENDER_STEPS.map(() => 'done')
  if (p.status === 'QUEUED' || p.status === 'DRAFT') return RENDER_STEPS.map(() => 'todo')
  const stage = p.renderStage === 'UPLOADING' ? 'EXPORTING' : p.renderStage
  const current = RENDER_STEPS.findIndex(s => s.key === stage)
  return RENDER_STEPS.map((_, i) => (current < 0 ? (i === 0 ? 'active' : 'todo') : i < current ? 'done' : i === current ? 'active' : 'todo'))
}

/** 失败时的友好标题；详细原因用后端的 errorMessage。 */
export const ERROR_TITLE: Record<string, string> = {
  PHOTO_DOWNLOAD_FAILED: '素材下载失败',
  MAP_FAILED: '地图生成失败',
  STORY_FAILED: '故事画面生成失败',
  MUSIC_UNAVAILABLE: '音乐不可用',
  ENCODE_FAILED: '视频合成失败',
  STORAGE_FAILED: '视频保存失败',
  RENDER_INTERRUPTED: '生成中断',
  STORYBOARD_MISSING: '分镜数据缺失',
  STORYBOARD_EMPTY: '分镜里没有可用段落',
  RENDER_FAILED: '生成失败'
}

export const errorTitle = (code?: string | null) => (code && ERROR_TITLE[code]) || '生成失败'

export const isRunning = (p?: Pick<VideoProject, 'status'> | null) => !!p && (p.status === 'QUEUED' || p.status === 'PROCESSING')

/** 模拟渲染器（本地联调）不生成真实文件，绝不能当成可播放的 MP4。 */
export const isMock = (p?: Pick<VideoProject, 'renderer' | 'outputUrl'> | null) =>
  !!p && (p.renderer === 'MOCK' || !!p.outputUrl?.includes('example.invalid'))

export const isPlayable = (p?: VideoProject | null) => !!p && p.status === 'COMPLETED' && !!p.outputUrl && !isMock(p)

export const PLAN_LIMITS: Record<Plan, { maxPhotos: number; durations: number[]; quality: string; watermark: boolean }> = {
  FREE: { maxPhotos: 10, durations: [15, 30], quality: '720p', watermark: true },
  PRO: { maxPhotos: 30, durations: [15, 30, 60], quality: '1080p', watermark: false }
}

export const CATEGORY_LABEL: Record<string, string> = {
  NONE: '无音乐',
  WARM: '温暖',
  CITY: '城市',
  FRESH: '清新',
  CINEMATIC: '电影感',
  CHILL: 'Chill'
}

export const SCENE_LABEL: Record<string, string> = {
  OPENING: '开场',
  MAP: '地图路线',
  PLACE: '地点',
  ACHIEVEMENTS: '旅行成就',
  ENDING: '结尾'
}

/** 00:07 这种时间码 */
export const timecode = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 后端返回的 LocalDateTime 是 UTC，没有时区后缀 */
export const utcDate = (value?: string | null) => (value ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`) : null)

export const formatDateTime = (value?: string | null) => {
  const d = utcDate(value)
  if (!d || Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
