import { describe, expect, it } from 'vitest'
import { sidebarItems } from '@/components/common/AppSidebar'
import { buildNotifications } from '@/components/common/NotificationCenter'
import { journeyHighlights } from '@/utils/summary'
import { statLine } from '@/utils/memories'
import type { TripSummary, TripView } from '@/services/tabitrace-api'

describe('成就下线后的兼容行为', () => {
  it('有无当前旅行时均不再提供成就导航', () => {
    for (const id of [null, 42]) {
      const nav = sidebarItems(id)
      expect([...nav.main, ...nav.secondary].some(item => /achievement/i.test(item.href + item.label))).toBe(false)
      expect(nav.secondary.some(item => item.href === '/memories')).toBe(true)
    }
  })

  it('旧数据携带成就时也不进入总结和回忆文案', () => {
    const legacy = { days: 3, places: 5, photos: 8, achievements: 99, dailyRecords: [] } as unknown as TripSummary
    expect(journeyHighlights(legacy)).toEqual([])
    expect(statLine(legacy)).toBe('3 天 · 5 个地点 · 8 张照片')
  })

  it('旧客户端数据不再生成成就通知，视频完成通知继续显示', () => {
    const legacy = {
      trip: { id: 42, status: 'ARCHIVED', planType: 'PRO' } as TripView,
      summary: null,
      achievements: [{ id: 1, earned: true, earnedAt: '2026-10-29T01:00:00Z', name: '旧徽章' }],
      videos: [{ id: 2, status: 'COMPLETED', completedAt: '2026-10-29T02:00:00Z', templateCode: 'JOURNAL', photoIds: [] }],
      shares: []
    }
    const items = buildNotifications(legacy as unknown as Parameters<typeof buildNotifications>[0])
    expect(items.map(item => item.id)).toEqual(['video-2'])
    expect(items.some(item => /achievements|旧徽章/.test(item.href + item.title))).toBe(false)
  })
})
