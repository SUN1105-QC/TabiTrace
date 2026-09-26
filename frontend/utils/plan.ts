/**
 * Trip Pro 升级中心的内容：全部由后端方案配置（GET /plans/trip-pro）推导，
 * 页面上的限制、对比、FAQ 不再各自写死数字。
 */

import type { TripSummary } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'

export type CatalogItem = { name: string; plan: 'FREE' | 'PRO' | string }
export type StoryTier = { maxPhotos: number; durations: number[]; quality: string; watermark: boolean }
export type TripProPlan = {
  price: { amount: number; currency: string }
  billing: 'ONE_TIME_PER_TRIP' | string
  renews: boolean
  expires: boolean
  realPayments: boolean
  freeLimits: { activeFreeTrips: number; checkinsPerTrip: number; photosPerTrip: number }
  storyFree: StoryTier
  storyPro: StoryTier
  storyTemplates: CatalogItem[]
  storyMusic: CatalogItem[]
}

export const planPrice = (p: TripProPlan) => formatCurrency(p.price.amount, p.price.currency)
/** 只有后端确认是“单次旅行、一次性、不续费、不过期”时，页面才做这些承诺 */
export const isOneTimePerTrip = (p: TripProPlan) => p.billing === 'ONE_TIME_PER_TRIP' && !p.renews && !p.expires

/** 720p → 720P */
const q = (s: string) => s.toUpperCase()
const secs = (d: number[]) => (d.length ? `${d.join(' / ')} 秒` : '—')
const names = (items: CatalogItem[]) => items.map(i => i.name).join('、')

export function storyDiff(p: TripProPlan) {
  const freeT = p.storyTemplates.filter(t => t.plan === 'FREE'), proT = p.storyTemplates.filter(t => t.plan === 'PRO')
  const freeM = p.storyMusic.filter(m => m.plan === 'FREE'), proM = p.storyMusic.filter(m => m.plan === 'PRO')
  return { freeT, proT, freeM, proM }
}

export type CompareRow = { group: string; label: string; free: string; pro: string }

export function planComparison(p: TripProPlan): CompareRow[] {
  const { freeT, freeM } = storyDiff(p)
  const f = p.freeLimits
  return [
    { group: '记录', label: '打卡次数（每段旅行）', free: `最多 ${f.checkinsPerTrip} 次`, pro: '不限' },
    { group: '记录', label: '照片（每段旅行）', free: `最多 ${f.photosPerTrip} 张`, pro: '不限' },
    { group: '记录', label: '同时进行中的免费旅行', free: `${f.activeFreeTrips} 段`, pro: '已升级的旅行不占免费名额' },
    { group: '分享成果', label: '旅行海报 · 九宫格 · 每日长图', free: '可以使用', pro: '可以使用，素材更多' },
    { group: 'Travel Story', label: '视频模板', free: freeT.length ? names(freeT) : '—', pro: `全部 ${p.storyTemplates.length} 款` },
    { group: 'Travel Story', label: '背景音乐', free: freeM.length ? `${freeM.length} 首基础音乐` : '—', pro: `全部 ${p.storyMusic.length} 首` },
    { group: 'Travel Story', label: '视频时长', free: secs(p.storyFree.durations), pro: secs(p.storyPro.durations) },
    { group: 'Travel Story', label: '清晰度', free: `${q(p.storyFree.quality)}${p.storyFree.watermark ? ' · 带水印' : ''}`, pro: `${q(p.storyPro.quality)}${p.storyPro.watermark ? ' · 带水印' : ' · 无水印'}` },
    { group: 'Travel Story', label: '每个视频可用照片', free: `最多 ${p.storyFree.maxPhotos} 张`, pro: `最多 ${p.storyPro.maxPhotos} 张` },
    { group: '回顾', label: '旅行总结 · 成就 · 旅行回忆 · 推荐探索', free: '可以使用', pro: '可以使用，记录更完整' }
  ]
}

export type ValueSection = { key: string; title: string; lead: string; points: string[] }

export function planValues(p: TripProPlan): ValueSection[] {
  const { proT, proM } = storyDiff(p)
  const f = p.freeLimits
  return [
    { key: 'record', title: '完整记录', lead: '整趟旅行想记多少就记多少。', points: [`打卡不再限 ${f.checkinsPerTrip} 次`, `照片不再限 ${f.photosPerTrip} 张`, '升级前的记录全部保留'] },
    { key: 'share', title: '精致分享', lead: '分享成果人人可用，Pro 让素材更充足。', points: ['旅行海报、九宫格、每日长图', '更多照片可以挑进海报与九宫格', '精选照片优先用于成果'] },
    { key: 'story', title: 'Travel Story', lead: '把这趟旅行做成一支完整的短片。', points: [`${q(p.storyPro.quality)}${p.storyPro.watermark ? '' : ' 无水印'}导出`, `最长 ${Math.max(...p.storyPro.durations)} 秒 · 最多 ${p.storyPro.maxPhotos} 张照片`, proT.length ? `Pro 模板：${names(proT)}` : '全部视频模板', proM.length ? `Pro 音乐：${names(proM)}` : '全部背景音乐'].filter(Boolean) },
    { key: 'review', title: '深度回顾', lead: '记录越完整，回看时越像当时。', points: ['旅行总结与成就统计全部打卡', '旅行回忆里能看到每一张照片', '时间轴按天完整保留'] }
  ]
}

export type Faq = { q: string; a: string }

export function planFaq(p: TripProPlan): Faq[] {
  const price = planPrice(p)
  const list: Faq[] = []
  if (isOneTimePerTrip(p)) {
    list.push(
      { q: 'Trip Pro 是订阅吗？', a: `不是。Trip Pro 是为某一段旅行一次性购买（${price}），不是按月或按年的订阅。` },
      { q: '会自动续费吗？', a: '不会。购买一次即完成，不会再次扣款，也不需要手动取消。' },
      { q: '每段旅行都需要分别购买吗？', a: '是的。Trip Pro 只对你选择升级的那一段旅行生效；新旅行仍然可以免费开始，只有选择升级的旅行收费。' },
      { q: 'Trip Pro 会过期吗？', a: '不会。升级后，这段旅行会一直保持 Trip Pro。' }
    )
  }
  list.push(
    { q: '已经结束或归档的旅行可以升级吗？', a: '可以。已完成或已归档的旅行也能升级；升级后，这段旅行之前的打卡与照片全部保留。' },
    { q: '免费旅行达到上限会怎样？', a: `已经记录的内容都会保留，只是不能再新增打卡（上限 ${p.freeLimits.checkinsPerTrip} 次）或照片（上限 ${p.freeLimits.photosPerTrip} 张）。升级 Trip Pro 后即可继续记录。` },
    { q: '分享成果需要 Trip Pro 吗？', a: '不需要。旅行海报、九宫格和每日长图对所有旅行开放；Trip Pro 主要解锁更多记录空间和完整的 Travel Story。' }
  )
  return list
}

/** 当前免费旅行的使用情况；打卡数来自每日记录的合计 */
export function tripUsage(summary: TripSummary | null, p: TripProPlan) {
  const checkins = summary ? summary.dailyRecords.reduce((n, d) => n + (d.checkins || 0), 0) : 0
  const photos = summary?.photos ?? 0
  return {
    checkins, photos,
    checkinLimit: p.freeLimits.checkinsPerTrip, photoLimit: p.freeLimits.photosPerTrip,
    checkinFull: checkins >= p.freeLimits.checkinsPerTrip, photoFull: photos >= p.freeLimits.photosPerTrip
  }
}
