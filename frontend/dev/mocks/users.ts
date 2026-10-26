import type { SessionView, UserView } from '@/services/tabitrace-api'
import { ID_BASE, MOCK_USER_ID } from './ids'

/** Mock 模式下的虚拟用户 SUN（登录仍然使用真实账号，只有业务数据换成这里的内容） */
export const mockUser: UserView = {
  id: MOCK_USER_ID,
  email: 'sun@mock.tabitrace.dev',
  nickname: 'SUN',
  bio: '喜欢慢慢走，在每座城市找一家好喝的咖啡店。',
  locale: 'zh-CN',
  timezone: 'Asia/Tokyo',
  distanceUnit: 'KM',
  defaultVisibility: 'PRIVATE',
  shareExactLocation: false,
  shareLinkExpiryDays: 0,
  emailNotifications: false,
  notifyTripReminder: true,
  notifyStory: true,
  notifyAchievement: true,
  notifyShare: true,
  createdAt: '2026-03-01T02:00:00'
}

export const mockSessions: SessionView[] = [
  { id: ID_BASE.session + 1, device: 'Edge · Windows', mobile: false, signedInAt: '2026-09-20T01:00:00', lastActiveAt: '2026-09-27T01:30:00', expiresAt: '2026-10-20T01:00:00', current: true },
  { id: ID_BASE.session + 2, device: 'Safari · iPhone', mobile: true, signedInAt: '2026-09-24T00:10:00', lastActiveAt: '2026-09-26T12:40:00', expiresAt: '2026-10-24T00:10:00', current: false }
]

/** Empty 模式的用户：刚注册、什么都还没有的新账户 */
export const emptyUser: UserView = {
  id: MOCK_USER_ID,
  email: 'empty@mock.tabitrace.dev',
  nickname: '新旅行者',
  locale: 'zh-CN',
  timezone: 'Asia/Tokyo',
  distanceUnit: 'KM',
  defaultVisibility: 'PRIVATE',
  shareExactLocation: false,
  shareLinkExpiryDays: 0,
  emailNotifications: false,
  notifyTripReminder: true,
  notifyStory: true,
  notifyAchievement: true,
  notifyShare: true,
  createdAt: '2026-09-27T00:00:00'
}
