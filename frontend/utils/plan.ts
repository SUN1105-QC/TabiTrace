/**
 * Trip Pro 升级中心的内容：全部由后端方案配置（GET /plans/trip-pro）推导，
 * 页面上的限制、对比、FAQ 不再各自写死数字。
 */

import type { TripSummary } from '@/services/tabitrace-api'
import { formatCurrency } from '@/utils/currency'
import { DEFAULT_SHARE_FREE, DEFAULT_SHARE_PRO } from '@/utils/share-tier'

export type CatalogItem = { name: string; plan: 'FREE' | 'PRO' | string }
export type StoryTier = { maxPhotos: number; durations: number[]; quality: string; watermark: boolean }
/** 分享图导出规格：posterWidth 城市海报宽度；scale 整张导出倍率；tileSize 九宫格单张边长；watermark 是否加水印 */
export type ShareTier = { quality: 'STANDARD' | 'HD' | string; posterWidth: number; scale: number; tileSize: number; watermark: boolean }
export type TripProPlan = {
  price: { amount: number; currency: string }
  billing: 'ONE_TIME_PER_TRIP' | string
  renews: boolean
  expires: boolean
  realPayments: boolean
  /** 单次旅行升级能否真正付款：Stripe 未配置、或金额低于 Stripe 单笔最低额时为 false */
  paymentsAvailable: boolean
  /** 不能付款的原因：NOT_CONFIGURED（支付未开放）/ BELOW_MINIMUM（金额低于 Stripe 最低额） */
  unavailableReason?: 'NOT_CONFIGURED' | 'BELOW_MINIMUM' | null
  /** 买断 · 终身 Pro：一次付款，账号下现有与以后新建的所有旅行都是 PRO */
  lifetime?: { price: { amount: number; currency: string }; billing: string; paymentsAvailable: boolean; unavailableReason?: string | null }
  freeLimits: { activeFreeTrips: number; checkinsPerTrip: number; photosPerTrip: number }
  storyFree: StoryTier
  storyPro: StoryTier
  /** 旧版本后端没有这两项时，前端用 utils/share-tier 的默认值 */
  shareFree?: ShareTier
  sharePro?: ShareTier
  storyTemplates: CatalogItem[]
  storyMusic: CatalogItem[]
  videoUsageLimits?: { enforced:boolean;dailyRenders:number;dailyOutputSeconds:number }
}

/** The same enforced limits are disclosed before purchase, including for anonymous visitors. */
export function videoUsageTerms(plan:TripProPlan) {
  const limits=plan.videoUsageLimits
  if(!limits?.enforced)return null
  const parts=[]
  if(limits.dailyRenders>0)parts.push(`每日最多提交 ${limits.dailyRenders} 次视频生成请求`)
  if(limits.dailyOutputSeconds>0)parts.push(`累计成片时长最多 ${limits.dailyOutputSeconds} 秒`)
  return parts.length?`${parts.join('，')}。Free 与 Pro 共用账号当日额度，按 UTC 统计日重置；失败后重新提交也计入次数。`:null
}

export const planPrice = (p: TripProPlan) => formatCurrency(p.price.amount, p.price.currency)
export const lifetimePrice = (p: TripProPlan) => (p.lifetime ? formatCurrency(p.lifetime.price.amount, p.lifetime.price.currency) : '')
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

/** 分享图导出规格（读不到方案配置时用与后端一致的默认值） */
export const shareFreeOf = (p: TripProPlan) => p.shareFree ?? DEFAULT_SHARE_FREE
export const shareProOf = (p: TripProPlan) => p.sharePro ?? DEFAULT_SHARE_PRO
const shareQuality = (t: ShareTier) => (t.quality === 'HD' ? '高清' : '标准清晰度')

/** Free 与 Trip Pro 的核心差异（10 项）；Travel Story 已不包含路线动画，这里不再列出 */
export function planComparison(p: TripProPlan): CompareRow[] {
  const { freeT, freeM } = storyDiff(p)
  const f = p.freeLimits
  const sf = shareFreeOf(p), sp = shareProOf(p)
  return [
    { group: '记录', label: '打卡次数（每段旅行）', free: `最多 ${f.checkinsPerTrip} 次`, pro: '不限' },
    { group: '记录', label: '照片（每段旅行）', free: `最多 ${f.photosPerTrip} 张`, pro: '不限' },
    { group: '分享成果', label: '海报 · 九宫格 · 每日长图', free: '全部可用', pro: '全部可用' },
    { group: '分享成果', label: '分享图清晰度', free: `${shareQuality(sf)} · 海报宽 ${sf.posterWidth}px`, pro: `${shareQuality(sp)} · 海报宽 ${sp.posterWidth}px` },
    { group: '分享成果', label: '分享图水印', free: sf.watermark ? '带「旅迹」水印' : '无水印', pro: sp.watermark ? '带「旅迹」水印' : '无水印' },
    { group: 'Travel Story', label: '视频模板', free: freeT.length ? names(freeT) : '—', pro: `全部 ${p.storyTemplates.length} 款` },
    { group: 'Travel Story', label: '每个视频的照片', free: `最多 ${p.storyFree.maxPhotos} 张`, pro: `最多 ${p.storyPro.maxPhotos} 张` },
    { group: 'Travel Story', label: '视频清晰度', free: `${q(p.storyFree.quality)}${p.storyFree.watermark ? ' · 带水印' : ' · 无水印'}`, pro: `${q(p.storyPro.quality)}${p.storyPro.watermark ? ' · 带水印' : ' · 无水印'}` },
    { group: 'Travel Story', label: '视频时长', free: secs(p.storyFree.durations), pro: secs(p.storyPro.durations) },
    { group: 'Travel Story', label: '背景音乐', free: freeM.length ? `${freeM.length} 首基础音乐` : '—', pro: `全部 ${p.storyMusic.length} 首${p.lifetime ? '；上传自己的音乐需买断 · 终身 Pro' : ''}` }
  ]
}

/** 升级后的 4 项核心权益：说明保持简短，fact 是从方案配置算出的具体数字 */
export type Benefit = { key: 'record' | 'share' | 'story' | 'style'; title: string; desc: string; fact: string }

export function planBenefits(p: TripProPlan): Benefit[] {
  const f = p.freeLimits
  const sp = shareProOf(p)
  const longest = Math.max(...p.storyPro.durations)
  return [
    { key: 'record', title: '完整旅行记录', desc: '不再限制这趟旅行的地点与照片，值得留下的都能留下。', fact: `打卡、照片不再限 ${f.checkinsPerTrip} 次 / ${f.photosPerTrip} 张` },
    { key: 'share', title: '高清分享成果', desc: `城市海报、九宫格、每日长图，以${shareQuality(sp)}${sp.watermark ? '' : '、无水印'}的方式保存和分享。`, fact: `海报宽 ${sp.posterWidth}px${sp.watermark ? '' : ' · 无水印'}` },
    { key: 'story', title: 'Travel Story', desc: '更多模板、更多照片，把这趟旅行剪成一支完整的竖屏短片。', fact: `${q(p.storyPro.quality)}${p.storyPro.watermark ? '' : ' 无水印'} · 最长 ${longest} 秒 · ${p.storyPro.maxPhotos} 张照片` },
    { key: 'style', title: '个性化表达', desc: '全部视频模板与背景音乐，让成片更像你的这一趟。', fact: `${p.storyTemplates.length} 款模板 · ${p.storyMusic.length} 首音乐` }
  ]
}

export type Faq = { q: string; a: string }

/** 常见问题（6 个以内），价格与权益都来自方案配置 */
export function planFaq(p: TripProPlan): Faq[] {
  const price = planPrice(p)
  const life = lifetimePrice(p)
  const list: Faq[] = []
  if (isOneTimePerTrip(p)) list.push({ q: 'Trip Pro 是订阅吗？', a: `不是。Trip Pro 是为单段旅行一次性购买（${price}），购买后这段旅行永久有效，不会自动续费。` })
  list.push({ q: 'Trip Pro 可以用于几趟旅行？', a: `一次购买只对应你选择升级的那一段旅行，其他旅行不受影响。${p.lifetime ? `如果希望账号下所有旅行都自动解锁，可以选择「买断 · 终身 Pro」（${life}）。` : ''}` })
  list.push({ q: '已经生成的成果以后还能下载吗？', a: '可以。分享成果随时可以在这段旅行里重新导出；生成好的 Travel Story 保存在这段旅行的视频列表里，可以再次下载。只要旅行还在你的账号中，就一直可以使用。' })
  list.push({ q: '升级后可以取消吗？', a: '已解锁的 Trip Pro 权益会一直保留在这段旅行上，不会自动取消，也不会再次扣款。具体退款规则以平台说明为准。' })
  if (p.lifetime) {
    list.push({ q: '买断 · 终身 Pro 和 Trip Pro 有什么区别？', a: `Trip Pro（${price}）只解锁当前这一段旅行；买断 · 终身 Pro（${life}）一次付款，账号下现有和以后新建的所有旅行都自动是 Trip Pro，并开通账号会员。` })
    list.push({ q: '自定义上传音乐需要什么权限？', a: '上传自己的音乐属于账号会员权益，买断 · 终身 Pro 会一并开通。单次 Trip Pro 可以使用全部内置背景音乐，但不包含上传自己的音乐。' })
  }
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
