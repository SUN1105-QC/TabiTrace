/**
 * 自动挑选照片（可替换策略）。目前没有真正的 AI 服务，用可解释、可复现的规则代替，不使用随机数：
 *   1. 过滤连拍重复：同一打卡、拍摄时间相差 2 秒以内只保留一张（精选优先）
 *   2. 精选照片优先
 *   3. 在不同打卡之间轮流挑选，让每个地点都有代表
 *   4. 最终按时间顺序排列（拍摄时间 → 所属打卡时间 → 上传时间）
 * 以后接入 AI 评分时，只需替换 score / pick 部分，函数签名保持不变。
 */

import type { CheckinView, PhotoView } from '@/services/tabitrace-api'

const BURST_MS = 2000

export function photoTime(p: PhotoView, checkins: Map<number, CheckinView>) {
  const raw = p.capturedAt || (p.checkinId ? checkins.get(p.checkinId)?.checkinTime : undefined) || p.createdAt || ''
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function autoSelectPhotos(photos: PhotoView[], checkinList: CheckinView[], max: number): number[] {
  if (max <= 0 || photos.length === 0) return []
  const checkins = new Map(checkinList.map(c => [c.id, c]))
  const byTime = [...photos].sort((a, b) => photoTime(a, checkins) - photoTime(b, checkins) || a.id - b.id)

  // 1. 连拍去重：只看真实拍摄时间。没有拍摄时间时退回的「打卡时间」对同一次打卡的照片完全相同，不能用来判断连拍
  const captured = (p: PhotoView) => (p.capturedAt ? photoTime({ ...p, checkinId: undefined }, checkins) : null)
  const unique: PhotoView[] = []
  for (const p of byTime) {
    const prev = unique[unique.length - 1]
    const a = prev ? captured(prev) : null, b = captured(p)
    const burst = prev && prev.checkinId === p.checkinId && a !== null && b !== null && Math.abs(b - a) < BURST_MS
    if (!burst) { unique.push(p); continue }
    if (p.featured && !prev.featured) unique[unique.length - 1] = p
  }

  // 2 + 3. 按打卡分组，组内精选在前；先轮流取精选，再轮流取其余
  const groups = new Map<string, PhotoView[]>()
  for (const p of unique) {
    const key = p.checkinId ? `c${p.checkinId}` : 'none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const queues = [...groups.values()]
  const picked = new Set<number>()
  const roundRobin = (filter: (p: PhotoView) => boolean) => {
    let progressed = true
    while (picked.size < max && progressed) {
      progressed = false
      for (const q of queues) {
        const next = q.find(p => !picked.has(p.id) && filter(p))
        if (next && picked.size < max) { picked.add(next.id); progressed = true }
      }
    }
  }
  roundRobin(p => !!p.featured)
  roundRobin(() => true)

  // 4. 时间顺序
  return unique.filter(p => picked.has(p.id)).map(p => p.id)
}
