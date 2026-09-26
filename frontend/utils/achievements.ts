/**
 * 旅行成就的统一规则：状态、分类、进度文案、行动入口、排序、城市收藏。
 * 所有组件都从这里取，不各自判断或拼字符串。数据全部来自 /trips/{id}/achievements。
 */

import type { AchievementView } from '@/services/tabitrace-api'

export type AchievementStatus = 'unlocked' | 'inProgress' | 'notStarted'

/** 已获得 → 已解锁；否则有任何进度 → 进行中；其余 → 未开始 */
export function getAchievementStatus(a: AchievementView): AchievementStatus {
  if (a.earned) return 'unlocked'
  return (a.current ?? 0) > 0 || a.progress > 0 ? 'inProgress' : 'notStarted'
}

export const STATUS_LABEL: Record<AchievementStatus, string> = { unlocked: '已解锁', inProgress: '进行中', notStarted: '未开始' }

/** 按条件类型划分的类别（筛选只显示数据里真实出现的类别） */
const CATEGORY: Record<string, { key: string; label: string; unit: string }> = {
  CHECKIN_COUNT: { key: 'RECORD', label: '记录', unit: '次打卡' },
  PHOTO_COUNT: { key: 'PHOTO', label: '摄影', unit: '张照片' },
  AREA_COUNT: { key: 'EXPLORE', label: '探索', unit: '个区域' },
  OFFICIAL_CHECKIN_COUNT: { key: 'EXPLORE', label: '探索', unit: '个官方地点' },
  TOKYO_TRADITION: { key: 'CULTURE', label: '城市文化', unit: '个传统地标' },
  TOKYO_NIGHT: { key: 'NIGHT', label: '夜景', unit: '个夜景地点' },
  TRIP_COMPLETED: { key: 'JOURNEY', label: '旅程', unit: '' }
}
const FALLBACK = { key: 'OTHER', label: '其他', unit: '项' }
export const categoryOf = (a: AchievementView) => CATEGORY[a.conditionType ?? ''] ?? FALLBACK

export type Progress = { current: number; target: number; remaining: number; ratio: number; text: string; done: boolean }

/**
 * 统一的进度表达：「2 / 5 · 还差 3 个区域」。
 * 处理 current 超过 target、target 为 0 / 空、字段缺失（退回百分比）等情况。
 */
export function formatAchievementProgress(a: AchievementView): Progress {
  const hasCounts = typeof a.current === 'number' && typeof a.target === 'number' && a.target > 0
  const target = hasCounts ? a.target! : 100
  const current = Math.max(0, hasCounts ? a.current! : a.progress ?? 0)
  const shown = Math.min(current, target)
  const remaining = Math.max(0, target - current)
  const done = a.earned || remaining === 0
  const ratio = target > 0 ? shown / target : 0
  const cat = categoryOf(a)
  let text: string
  if (done) text = '已达成'
  else if (!hasCounts) text = `已完成 ${Math.round(ratio * 100)}%`
  else if (a.conditionType === 'TRIP_COMPLETED') text = '完成这段旅行后解锁'
  else text = `还差 ${remaining} ${cat.unit}`
  return { current: shown, target, remaining, ratio, text, done }
}

export type AchievementAction = { label: string; href?: string; checkin?: boolean }

/** 根据成就类型给出下一步入口，只使用项目已有路由 */
export function achievementAction(a: AchievementView, tripId: number): AchievementAction {
  const tokyo = a.cityCode === 'TOKYO'
  switch (a.conditionType) {
    case 'CHECKIN_COUNT': return { label: '去打卡', checkin: true }
    case 'PHOTO_COUNT': return { label: '去拍照', href: `/trips/${tripId}/gallery` }
    case 'AREA_COUNT': return { label: '开始探索', href: tokyo ? '/explore/tokyo' : `/trips/${tripId}/map` }
    case 'OFFICIAL_CHECKIN_COUNT': return { label: '开始探索', href: '/explore/tokyo' }
    case 'TOKYO_TRADITION': return { label: '查看寺社', href: '/explore/tokyo?filter=SHRINE' }
    case 'TOKYO_NIGHT': return { label: '夜晚东京', href: '/explore/tokyo?filter=NIGHT' }
    case 'TRIP_COMPLETED': return { label: '查看旅程', href: `/trips/${tripId}` }
    default: return { label: '查看旅程', href: `/trips/${tripId}` }
  }
}

/** 默认排序：最近解锁 → 最接近完成 → 未开始 */
export function sortAchievements(list: AchievementView[]) {
  const rank = { unlocked: 0, inProgress: 1, notStarted: 2 }
  return [...list].sort((a, b) => {
    const sa = getAchievementStatus(a), sb = getAchievementStatus(b)
    if (sa !== sb) return rank[sa] - rank[sb]
    if (sa === 'unlocked') return (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '')
    if (sa === 'inProgress') return formatAchievementProgress(b).ratio - formatAchievementProgress(a).ratio
    return a.id - b.id
  })
}

/** 最接近完成的未解锁成就（进度比例最高，其次还差得最少） */
export function nextAchievements(list: AchievementView[], count = 3) {
  return list.filter(a => !a.earned).map(a => ({ a, p: formatAchievementProgress(a) }))
    .sort((x, y) => y.p.ratio - x.p.ratio || x.p.remaining - y.p.remaining)
    .slice(0, count).map(x => x.a)
}

export const recentlyUnlocked = (list: AchievementView[], count = 3) =>
  list.filter(a => a.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '')).slice(0, count)

/** 已知城市的展示信息；未收录的城市用城市代码本身，不写死只支持东京 */
const CITY: Record<string, { name: string; en: string; explore?: string }> = {
  TOKYO: { name: '东京', en: 'TOKYO', explore: '/explore/tokyo' }
}
export type CityCollection = { code: string; name: string; en: string; explore?: string; achievements: AchievementView[]; unlocked: number }

export function cityCollections(list: AchievementView[]): CityCollection[] {
  const codes = Array.from(new Set(list.filter(a => a.type === 'CITY' && a.cityCode).map(a => a.cityCode!)))
  return codes.map(code => {
    const achievements = sortAchievements(list.filter(a => a.cityCode === code))
    const info = CITY[code] ?? { name: code, en: code }
    return { code, ...info, achievements, unlocked: achievements.filter(a => a.earned).length }
  })
}

export const dotDate = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '')
