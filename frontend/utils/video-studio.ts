/**
 * Travel Story 工作台的展示规则：视觉风格、音乐分类、素材建议。
 * 素材建议完全基于真实数据的规则判断（同一地点照片过多、连拍、素材过少/过多），不是模型推断。
 */

import type { CheckinView, PhotoView } from '@/services/tabitrace-api'
import type { VideoMusic, VisualStyle } from '@/types/video'

/** 视觉风格：filter 用于网页预览，成片由 video-worker 用对应的 FFmpeg 滤镜调色（见 FfmpegRenderer.gradeFilter） */
export const VISUAL_STYLES: { code: VisualStyle; name: string; en: string; desc: string; filter: string }[] = [
  { code: 'NATURAL', name: '自然纪实', en: 'Natural', desc: '保留照片原本的色彩', filter: 'none' },
  { code: 'FRESH', name: '日系清新', en: 'Fresh', desc: '明亮通透，带一点空气感', filter: 'brightness(1.07) contrast(.94) saturate(.86) hue-rotate(-4deg)' },
  { code: 'FILM', name: '电影胶片', en: 'Film', desc: '暖调高光、颗粒与暗角', filter: 'sepia(.16) contrast(1.06) saturate(.82) brightness(.98)' },
  { code: 'URBAN', name: '城市质感', en: 'Urban', desc: '高对比、冷调的城市感', filter: 'contrast(1.14) saturate(.72) brightness(.97) hue-rotate(6deg)' }
]

export const styleOf = (code?: string | null) => VISUAL_STYLES.find(s => s.code === code) ?? VISUAL_STYLES[0]

/** 音乐分类标签：「推荐」把当前模板推荐的曲目排在最前 */
export const MUSIC_TABS: { key: string; label: string }[] = [
  { key: 'REC', label: '推荐' },
  { key: 'WARM', label: '治愈' },
  { key: 'FRESH', label: '日系' },
  { key: 'CITY', label: '城市' },
  { key: 'CHILL', label: 'Chill' },
  { key: 'CINEMATIC', label: '电影感' }
]

export function musicFor(tab: string, music: VideoMusic[], templateCode: string) {
  const tracks = music.filter(m => m.code !== 'NONE')
  if (tab !== 'REC') return tracks.filter(m => m.category === tab)
  return [...tracks.filter(m => m.recommendedTemplate === templateCode), ...tracks.filter(m => m.recommendedTemplate !== templateCode)]
}

/** 02:48 形式的时长 */
export const clock = (s?: number | null) => (s && Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--')

/** 已选照片涉及的打卡地点数 */
export function placeCount(ids: number[], photosById: Map<number, PhotoView>) {
  return new Set(ids.map(id => photosById.get(id)?.checkinId).filter(v => v != null)).size
}

export type Suggestion = { title: string; text: string; action?: { label: string; remove?: number[]; autopick?: boolean } }

const BURST_SECONDS = 3

/**
 * 素材建议（按优先级只给一条）：
 * 1. 同一地点选了 3 张以上 → 每个地点保留 2 张；
 * 2. 拍摄时间相差不到 3 秒的连拍 → 每组保留 1 张；
 * 3. 素材太少 → 建议智能选片补充；
 * 4. 素材太多、每张停留不到 1 秒 → 提示减少素材或加长时长。
 */
export function suggestion(ids: number[], photosById: Map<number, PhotoView>, checkinsById: Map<number, CheckinView>, duration: number, available: number): Suggestion | null {
  const byPlace = new Map<number, number[]>()
  ids.forEach(id => {
    const c = photosById.get(id)?.checkinId
    if (c != null) byPlace.set(c, [...(byPlace.get(c) ?? []), id])
  })
  const crowded = [...byPlace.entries()].filter(([, list]) => list.length >= 3)
  if (crowded.length) {
    const [checkinId, list] = crowded[0]
    const place = checkinsById.get(checkinId)?.placeName ?? '同一地点'
    return {
      title: '有几张照片来自同一个地点',
      text: `「${place}」选了 ${list.length} 张照片，画面会比较相似。建议每个地点保留 2 张，让视频节奏更自然。`,
      action: { label: '优化素材', remove: crowded.flatMap(([, l]) => l.slice(2)) }
    }
  }

  const timed = ids.map(id => ({ id, t: photosById.get(id)?.capturedAt ? Date.parse(photosById.get(id)!.capturedAt!) : NaN })).filter(x => !Number.isNaN(x.t)).sort((a, b) => a.t - b.t)
  const bursts = timed.filter((x, i) => i > 0 && x.t - timed[i - 1].t <= BURST_SECONDS * 1000).map(x => x.id)
  if (bursts.length) {
    return {
      title: '发现可能的连拍照片',
      text: `有 ${bursts.length} 张照片与前一张的拍摄时间相差不到 ${BURST_SECONDS} 秒，看起来很相似。建议每组保留 1 张。`,
      action: { label: '优化素材', remove: bursts }
    }
  }

  if (ids.length > 0 && ids.length < 4 && available > ids.length) {
    return {
      title: '素材还可以再多一点',
      text: `目前只有 ${ids.length} 张照片，${duration} 秒的视频里每张要停留约 ${Math.round(duration / ids.length)} 秒。再加几张会更生动。`,
      action: { label: '智能补充素材', autopick: true }
    }
  }

  if (ids.length >= 4 && duration / ids.length < 1) {
    return {
      title: '素材有点多',
      text: `${ids.length} 张照片放进 ${duration} 秒，每张只停留不到 1 秒。可以减少几张，或选择更长的视频时长。`
    }
  }
  return null
}
