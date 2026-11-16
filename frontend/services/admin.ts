import { api, downloadApi, jsonBody } from './api'
import type { UserView } from './tabitrace-api'

export type SupportMessage = {
  id: number
  userId: number
  email: string
  nickname: string
  subject: string
  content: string
  reply?: string
  status: 'OPEN' | 'REPLIED'
  createdAt: string
  repliedAt?: string
}
export type AdminUser = Required<
  Pick<
    UserView,
    | 'id'
    | 'email'
    | 'nickname'
    | 'role'
    | 'userLevel'
    | 'tripLimit'
    | 'tripRetentionMonths'
    | 'canShare'
    | 'canVideo'
    | 'customMusicAccess'
  >
> & {
  status: 'ACTIVE' | 'DISABLED' | 'DELETION_PENDING'
  trips: number
  photos: number
  createdAt: string
  avatarUrl?: string | null
  /** 服务端原样返回的微秒时间戳；不能转为 JS Date，否则丢失精度导致冲突判断失真。 */
  updatedAt: string
  deletionScheduledAt?: string | null
  deletionRequestedByAdmin?: boolean
  deletionPreviousStatus?: 'ACTIVE' | 'DISABLED' | null
}
export type UserPermissionsInput = Pick<
  AdminUser,
  'userLevel' | 'tripLimit' | 'tripRetentionMonths' | 'canShare' | 'canVideo' | 'customMusicAccess'
> & { status: 'ACTIVE' | 'DISABLED'; expectedUpdatedAt: string }
export type AdminPageResult<T> = { items: T[]; total: number; page: number; pageSize: number }
export type AdminUserStatus = '' | AdminUser['status']
export type AdminOverview = {
  users: number
  disabledUsers: number
  trips: number
  photos: number
  videos: number
  activeRenders: number
  expiringTrips: number
  pendingDeletionTrips: number
  openMessages: number
  photoBytes: number
  videoBytes: number
}
export const adminApi = {
  overview: (signal?: AbortSignal) => api<AdminOverview>('/admin/overview', { signal }),
  users: (q = '', page = 1, status: AdminUserStatus = '', pageSize = 25, signal?: AbortSignal) =>
    api<AdminPageResult<AdminUser>>(
      `/admin/users?${new URLSearchParams({ q, page: String(page), status, pageSize: String(pageSize) })}`, { signal },
    ),
  user: (id: number, signal?: AbortSignal) => api<AdminUser>(`/admin/users/${id}`, { signal }),
  updateUser: (id: number, input: UserPermissionsInput) =>
    api<AdminUser>(`/admin/users/${id}`, { method: 'PUT', body: jsonBody(input) }),
  messages: (status = '', page = 1) => api<SupportMessage[]>(`/admin/messages?status=${status}&page=${page}`),
  messagePage: (status = '', page = 1, signal?: AbortSignal) =>
    api<AdminPageResult<SupportMessage>>(`/admin/messages/page?${new URLSearchParams({ status, page: String(page) })}`, { signal }),
  reply: (id: number, reply: string) =>
    api<SupportMessage>(`/admin/messages/${id}/reply`, { method: 'POST', body: jsonBody({ reply }) }),
}
export const supportApi = {
  messages: () => api<SupportMessage[]>('/support/messages'),
  send: (subject: string, content: string) =>
    api<SupportMessage>('/support/messages', { method: 'POST', body: jsonBody({ subject, content }) }),
}
export async function exportTrip(id: number) {
  const blob = await downloadApi(`/trips/${id}/export`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tabitrace-trip-${id}.zip`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
