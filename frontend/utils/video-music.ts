/**
 * Travel Story「音乐与氛围」：分类标签、授权标签、规则推荐。
 * 推荐完全是确定的规则打分（模板、视频时长、照片数量与拍摄时段、目的地类型、曲目能量），不随机、不调用模型；
 * 曲库、分类、FREE / PRO、推荐模板都来自后端（GET /video-music），新增或下架曲目不需要改这里。
 */

import type { MusicCategory, MusicSource, Plan, VideoMusic } from '@/types/video'
import type { UserMusic, UserMusicLibrary } from '@/types/user-music'

export type MusicTabKey = 'REC' | MusicCategory | 'NONE'

export const MUSIC_TABS: { key: MusicTabKey; label: string }[] = [
  { key: 'REC', label: '推荐' },
  { key: 'WARM', label: '温暖旅程' },
  { key: 'CITY_NIGHT', label: '城市夜色' },
  { key: 'MORNING', label: '清晨治愈' },
  { key: 'LOFI', label: 'Lo-fi' },
  { key: 'CINEMATIC', label: '电影感' },
  { key: 'NONE', label: '无音乐' }
]

export const MUSIC_CATEGORY_LABEL: Record<string, string> = {
  WARM: '温暖旅程', CITY_NIGHT: '城市夜色', MORNING: '清晨治愈', LOFI: 'Lo-fi', CINEMATIC: '电影感'
}

const MOOD_LABEL: Record<string, string> = {
  warm: '温暖', nostalgic: '怀旧', calm: '平静', cinematic: '电影感', urban: '都市', night: '夜晚', morning: '清晨', romantic: '浪漫',
  happy: '轻快', slow: '舒缓', nature: '自然', japan: '日系', lofi: 'Lo-fi', chill: 'Chill', acoustic: '原声', piano: '钢琴', electronic: '电子'
}
export const moodLabels = (m: VideoMusic) => m.moods.map(x => MOOD_LABEL[x] ?? x)

/** 背景音乐默认音量：成片统一到 -16 LUFS 后再乘以它，背景层不抢画面 */
export const DEFAULT_MUSIC_VOLUME = 50

/** 卡片上的简短授权标签：用户不需要读法律条文 */
export function licenseTag(m: Pick<VideoMusic, 'license' | 'attributionRequired'>) {
  const l = (m.license ?? '').toUpperCase()
  if (l.startsWith('CC0')) return 'CC0'
  if (l.includes('PUBLIC DOMAIN')) return 'Public Domain'
  if (l.startsWith('CC BY')) return m.attributionRequired ? 'CC BY · 需署名' : 'CC BY'
  return m.attributionRequired ? '需署名' : (m.license || '已授权')
}

/** 02:48 形式的时长 */
export const clock = (s?: number | null) => (s != null && Number.isFinite(s) && s >= 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--')

export type MusicContext = {
  templateCode: string
  /** 目的地与城市名（用于判断大城市 / 自然风光） */
  destination: string
  /** 视频时长（秒） */
  duration: number
  /** 已选照片的拍摄小时（用户时区） */
  photoHours: number[]
  photoCount: number
  plan: Plan
  /** 模板在后台配置的默认音乐 */
  templateDefault?: string | null
}

const BIG_CITY = /东京|大阪|上海|首尔|纽约|香港|台北|伦敦|巴黎|新加坡|曼谷|北京|深圳|广州|tokyo|osaka|seoul|new york|london|paris|singapore|bangkok/i
const NATURE = /北海道|富士|山|湖|海|岛|森林|草原|峡谷|冲绳|hokkaido|fuji|lake|island|mountain|beach/i

/** 模板与氛围分类的匹配分（指令：Journal → Warm +3 / Lo-fi +2；Minimal → Morning +3；City → City Night +3 / Lo-fi +2） */
const CATEGORY_FIT: Record<string, Partial<Record<MusicCategory, number>>> = {
  JOURNAL: { WARM: 3, LOFI: 2, CINEMATIC: 1 },
  MINIMAL: { MORNING: 3, CINEMATIC: 2, WARM: 1 },
  CITY: { CITY_NIGHT: 3, LOFI: 2 }
}
/** 模板偏好的音色 / 情绪 */
const MOOD_FIT: Record<string, Record<string, number>> = {
  JOURNAL: { acoustic: 2, warm: 1 },
  MINIMAL: { piano: 2, morning: 1, calm: 1 },
  CITY: { electronic: 3, night: 1, urban: 1 }
}

type Scored = { m: VideoMusic; score: number; reasons: string[] }

/** 单首曲目的规则分数与推荐理由（理由按贡献排序，最多 2 条） */
export function scoreMusic(m: VideoMusic, ctx: MusicContext): Scored {
  const parts: [number, string][] = []
  const add = (n: number, reason = '') => { if (n) parts.push([n, reason]) }
  const tpl = ctx.templateCode
  const tplName = tpl === 'CITY' ? 'City' : tpl === 'MINIMAL' ? 'Minimal' : 'Journal'
  if (m.code === ctx.templateDefault) add(2, `${tplName} 模板默认`)
  if (m.recommendedTemplates.includes(tpl)) add(3, `适合 ${tplName} 模板`)
  add(CATEGORY_FIT[tpl]?.[m.category] ?? 0, MUSIC_CATEGORY_LABEL[m.category])
  m.moods.forEach(x => add(MOOD_FIT[tpl]?.[x] ?? 0))
  if (tpl === 'CITY' && m.energy === 'HIGH') add(1, '节奏明快')

  // 视频时长：短视频偏明快，长视频偏舒缓
  const e = m.energy ?? 'MEDIUM'
  if (ctx.duration <= 15) add(e === 'HIGH' ? 1 : e === 'MEDIUM' ? 0.5 : -0.5, e !== 'LOW' ? '短视频节奏更合适' : '')
  else if (ctx.duration >= 60) add(e === 'LOW' ? 1 : e === 'MEDIUM' ? 0.5 : -0.5, e !== 'HIGH' ? '长视频听着不累' : '')
  else if (e === 'MEDIUM') add(0.5)

  // 照片：多而快的剪辑配明快一点，少量照片配舒缓
  if (ctx.photoCount >= 15 && e !== 'LOW') add(0.5)
  if (ctx.photoCount > 0 && ctx.photoCount <= 5 && e === 'LOW') add(0.5)
  const n = ctx.photoHours.length || 1
  const share = (test: (h: number) => boolean) => ctx.photoHours.filter(test).length / n
  if (share(h => h >= 19 || h < 5) >= 0.4 && (m.moods.includes('night') || m.category === 'CITY_NIGHT')) add(1.5, '夜晚照片多')
  if (share(h => h >= 5 && h < 10) >= 0.3 && (m.moods.includes('morning') || m.category === 'MORNING')) add(1.5, '清晨照片多')

  // 目的地
  if (BIG_CITY.test(ctx.destination)) add(m.category === 'CITY_NIGHT' ? 1 : m.category === 'LOFI' ? 0.5 : 0, '城市旅行')
  if (NATURE.test(ctx.destination)) add(m.category === 'CINEMATIC' ? 1 : m.category === 'MORNING' ? 0.5 : 0, '自然风光')

  // Free 旅行优先推荐能直接用的曲目（PRO 曲目仍可试听）
  if (ctx.plan === 'FREE' && m.plan === 'PRO') add(-2)

  const score = parts.reduce((s, [v]) => s + v, 0)
  const reasons = parts.filter(([v, r]) => v > 0 && r).sort((a, b) => b[0] - a[0]).map(([, r]) => r)
  return { m, score, reasons: Array.from(new Set(reasons)).slice(0, 2) }
}

/** 按规则分数排序；分数相同按后台的曲库顺序（sort_order），保证每次结果一致 */
export function rankMusic(music: VideoMusic[], ctx: MusicContext): Scored[] {
  return music.map((m, i) => ({ s: scoreMusic(m, ctx), i }))
    .sort((a, b) => b.s.score - a.s.score || a.i - b.i)
    .map(x => x.s)
}

/** 「为这趟旅行推荐」：前 n 首 */
export const recommendMusic = (music: VideoMusic[], ctx: MusicContext, n = 3) => rankMusic(music, ctx).slice(0, n)

/**
 * 模板的默认音乐：后台配置的模板默认曲（可用且当前方案能用）优先，否则取规则推荐里当前方案能用的第一首；
 * 曲库为空时返回 null（无音乐）。
 */
export function defaultMusicFor(music: VideoMusic[], ctx: MusicContext): string | null {
  const allowed = (m: VideoMusic) => ctx.plan === 'PRO' || m.plan === 'FREE'
  const configured = music.find(m => m.code === ctx.templateDefault && allowed(m))
  if (configured) return configured.code
  return rankMusic(music, ctx).find(x => allowed(x.m))?.m.code ?? null
}

// ───────────── 音乐来源：旅迹音乐（SYSTEM）/ 我的音乐（USER）─────────────

/** 当前选择：旅迹音乐按代码、我的音乐按 id；null = 无音乐。项目里只保存来源 + id，不保存音乐地址 */
export type MusicSelection = { source: 'SYSTEM'; code: string } | { source: 'USER'; id: number } | null

/** 从草稿 / 项目读出选择（旧数据没有 musicSource 时按字段推断） */
export function selectionOf(d: { musicSource?: MusicSource | null; musicCode?: string | null; userMusicId?: number | null }): MusicSelection {
  if (d.musicSource === 'USER' || (d.musicSource == null && d.userMusicId != null)) return d.userMusicId != null ? { source: 'USER', id: d.userMusicId } : null
  return d.musicCode ? { source: 'SYSTEM', code: d.musicCode } : null
}

/** 写回草稿的三个字段 */
export function draftMusic(sel: MusicSelection): { musicSource: MusicSource | null; musicCode: string | null; userMusicId: number | null } {
  if (!sel) return { musicSource: null, musicCode: null, userMusicId: null }
  return sel.source === 'USER'
    ? { musicSource: 'USER', musicCode: null, userMusicId: sel.id }
    : { musicSource: 'SYSTEM', musicCode: sel.code, userMusicId: null }
}

export const sameSelection = (a: MusicSelection, b: MusicSelection) =>
  a === b || (!!a && !!b && a.source === b.source && (a.source === 'USER' ? a.id === (b as { id: number }).id : a.code === (b as { code: string }).code))

/** 摘要里显示的音乐名 */
export function selectionLabel(sel: MusicSelection, music: VideoMusic[], mine: UserMusic[] | null) {
  if (!sel) return '无音乐'
  if (sel.source === 'SYSTEM') return music.find(m => m.code === sel.code)?.name ?? '原音乐已下架'
  if (!mine) return '我的音乐'
  const m = mine.find(x => x.id === sel.id)
  return m ? `${m.title}（我的音乐）` : '原音乐已被删除'
}

/**
 * 这首音乐现在能不能用来生成：能用返回空字符串，否则返回原因（前端先提示；后端保存 / 生成时还会再检查）。
 * 我的音乐：已删除 / 未处理完成 / 会员到期都不能用于新视频。
 */
export function selectionProblem(sel: MusicSelection, ctx: {
  music: VideoMusic[]; musicReady: boolean; plan: Plan; mine: UserMusicLibrary | null
}): string {
  if (!sel) return ''
  if (sel.source === 'SYSTEM') {
    const m = ctx.music.find(x => x.code === sel.code)
    if (!m) return ctx.musicReady ? '原选择的音乐已下架，请在「背景音乐」里重新选择' : ''
    return ctx.plan === 'FREE' && m.plan === 'PRO' ? '当前音乐是 Trip Pro 曲目，请换一首标有 FREE 的音乐' : ''
  }
  if (!ctx.mine) return ''
  const m = ctx.mine.items.find(x => x.id === sel.id)
  if (!m) return '原音乐已被删除，请在「背景音乐」里重新选择'
  if (!ctx.mine.canUse) return ctx.mine.membership.status === 'EXPIRED' ? '会员已到期，续费后可继续使用自定义音乐；也可以换成旅迹音乐' : '使用自己的音乐需要开通会员'
  if (m.status !== 'READY') return `「${m.title}」还不能使用，请换一首音乐`
  return ''
}
