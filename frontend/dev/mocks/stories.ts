import type { PaymentView, ShareLinkView } from '@/services/tabitrace-api'
import type { StorySettings, VideoProject } from '@/types/video'
import { ID_BASE, MOCK_TRIP_HOKKAIDO, MOCK_TRIP_KYOTO, MOCK_TRIP_TOKYO } from './ids'

export const defaultStorySettings = (): StorySettings => ({
  showTitle: true, showDate: true, showPlaceNames: true, showCheckinText: true, showWeather: false, showStats: true,
  showAchievements: false, showEnding: true, segments: [], visualStyle: 'NATURAL'
})

/**
 * Travel Story：renderer 标为 MOCK，outputUrl 用 example.invalid 占位（与后端的本地 Mock 渲染器一致），
 * 视频页据此显示「Local Mock Renderer」而不是尝试播放一个不存在的 MP4。
 */
export const mockVideos: VideoProject[] = [
  {
    id: ID_BASE.video + 1, tripId: MOCK_TRIP_TOKYO, name: '东京五日散步 · Journal', templateCode: 'JOURNAL', aspectRatio: '9:16', duration: 30, quality: '1080p',
    resolution: '1080×1920', watermark: false, musicCode: 'SB_WANDERLUST', coverPhotoId: ID_BASE.photo + 13, showText: true, showAchievements: false,
    settings: defaultStorySettings(), status: 'COMPLETED', progress: 100, renderer: 'MOCK', outputUrl: 'https://example.invalid/mock/tokyo-journal.mp4',
    photoIds: [1, 4, 5, 9, 11, 13].map(n => ID_BASE.photo + n), createdAt: '2026-09-26T13:00:00', updatedAt: '2026-09-26T13:02:00', completedAt: '2026-09-26T13:02:00'
  },
  {
    id: ID_BASE.video + 2, tripId: MOCK_TRIP_KYOTO, name: '京都春日漫游 · Journal', templateCode: 'JOURNAL', aspectRatio: '9:16', duration: 15, quality: '720p',
    resolution: '720×1280', watermark: true, musicCode: 'KM_MORNING', coverPhotoId: ID_BASE.photo + 21, showText: true, showAchievements: false,
    settings: defaultStorySettings(), status: 'COMPLETED', progress: 100, renderer: 'MOCK', outputUrl: 'https://example.invalid/mock/kyoto-journal.mp4',
    photoIds: [21, 22, 24].map(n => ID_BASE.photo + n), createdAt: '2026-04-08T11:00:00', updatedAt: '2026-04-08T11:01:00', completedAt: '2026-04-08T11:01:00'
  }
]

/** 分享链接（token 以 mock- 开头，一眼能认出是 Mock 数据） */
export const mockShares: (ShareLinkView & { tripId: number })[] = [
  { id: ID_BASE.share + 1, tripId: MOCK_TRIP_TOKYO, token: 'mock-share-tokyo-001', status: 'ACTIVE', viewCount: 12, createdAt: '2026-09-26T14:00:00', url: '/s/mock-share-tokyo-001' },
  { id: ID_BASE.share + 2, tripId: MOCK_TRIP_KYOTO, token: 'mock-share-kyoto-001', status: 'REVOKED', viewCount: 5, createdAt: '2026-04-08T12:00:00', revokedAt: '2026-05-01T00:00:00', url: '/s/mock-share-kyoto-001' }
]

export const mockPayments: PaymentView[] = [
  { id: ID_BASE.payment + 1, tripId: MOCK_TRIP_TOKYO, provider: 'MOCK', providerPaymentId: 'mock-pay-tokyo-001', amount: 400, currency: 'CNY', status: 'PAID', paidAt: '2026-09-12T02:00:00', createdAt: '2026-09-12T02:00:00' },
  { id: ID_BASE.payment + 2, tripId: MOCK_TRIP_HOKKAIDO, provider: 'MOCK', providerPaymentId: 'mock-pay-hokkaido-001', amount: 400, currency: 'CNY', status: 'PAID', paidAt: '2026-09-15T04:00:00', createdAt: '2026-09-15T04:00:00' }
]
