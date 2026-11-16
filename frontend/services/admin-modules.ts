import { api, jsonBody } from './api'
import type { AdminPageResult, AdminUser, UserPermissionsInput } from './admin'

export const adminSections = {
  overview: '首页概览',
  users: '用户管理', messages: '留言管理', invitations: '注册邀请', content: '内容管理', media: '媒体管理',
  settings: '系统设置', logs: '审计日志', maintenance: '运行维护',
} as const
export type AdminSection = keyof typeof adminSections
export type ExtraSection = Exclude<AdminSection, 'users' | 'messages' | 'overview'>
export type Invitation = { id: number; email: string; nickname: string; status: 'PENDING' | 'ACCEPTED' | 'REVOKED'; userId?: number; createdAt: string; updatedAt: string }
export type RegistrationDefaults = Omit<UserPermissionsInput, 'status' | 'expectedUpdatedAt'> & { updatedAt: string }
export type AdminTrip = { id: number; userId: number; title: string; email: string; nickname: string; destinationName: string; status: string; visibility: string; photos: number; checkins: number; activeShares: number; createdAt: string; updatedAt: string; expiresAt: string; expired: boolean }
export type MediaKind = 'PHOTO' | 'VIDEO' | 'MUSIC'
export type AdminMedia = { id: number; userId: number; tripId?: number | null; title: string; email: string; status: string; kind: MediaKind; fileSize: number | null; createdAt: string; updatedAt: string }
export type AuditEntry = { id: number; adminId: number; userId: number; action: string; details: string; createdAt: string }
export type MaintenanceSummary = { expiredTrips: number; dueAccounts: number; musicFiles: number; pendingVideoFiles: number }
export type MaintenanceJob = { id: number; kind: 'TRIPS' | 'ACCOUNTS' | 'MUSIC'; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'; result?: string; createdAt: string; startedAt?: string; completedAt?: string }
export type RuntimeSettings = { storageMode: string; mailProvider: string; javaVersion: number; costEnforce: boolean; accountDailyRenders: number; accountDailySeconds: number; globalActiveRenders: number }
const query = (values: Record<string, string | number>) => new URLSearchParams(Object.entries(values).map(([key,value]) => [key,String(value)]))
const post = <T>(path: string, input: unknown) => api<T>(path, { method: 'POST', body: jsonBody(input) })
export const adminModules = {
  invitations: (page: number, signal?: AbortSignal) => api<AdminPageResult<Invitation>>(`/admin/invitations?page=${page}`, { signal }),
  invite: (email: string, nickname: string) => post<Invitation>('/admin/invitations', { email, nickname }),
  invitationAction: (i: Invitation, action: 'RESEND' | 'REVOKE') => post<Invitation>(`/admin/invitations/${i.id}/${action}`, { expectedUpdatedAt: i.updatedAt }),
  deleteUser: (u: AdminUser, confirmationEmail: string) => post<AdminUser>(`/admin/users/${u.id}/deletion`, { expectedUpdatedAt: u.updatedAt, confirmationEmail }),
  restoreUser: (u: AdminUser) => post<AdminUser>(`/admin/users/${u.id}/cancel-deletion`, { expectedUpdatedAt: u.updatedAt }),
  defaults: (signal?: AbortSignal) => api<RegistrationDefaults>('/admin/settings/defaults', { signal }),
  saveDefaults: (d: RegistrationDefaults) => api<RegistrationDefaults>('/admin/settings/defaults', { method: 'PUT', body: jsonBody({ ...d, expectedUpdatedAt: d.updatedAt }) }),
  runtime: (signal?: AbortSignal) => api<RuntimeSettings>('/admin/settings/runtime', { signal }),
  trips: (q: string, status: string, page: number, signal?: AbortSignal) => api<AdminPageResult<AdminTrip>>(`/admin/trips?${query({ q, status, page })}`, { signal }),
  tripAction: (t: AdminTrip, action: 'ARCHIVE' | 'UNARCHIVE' | 'REVOKE_SHARES' | 'DELETE', confirmation = '') => post<void>(`/admin/trips/${t.id}/action`, { action, expectedUpdatedAt: t.updatedAt, confirmation }),
  media: (kind: string, q: string, status: string, page: number, signal?: AbortSignal) => api<AdminPageResult<AdminMedia>>(`/admin/media?${query({ kind,q,status,page })}`, { signal }),
  deleteMedia: (m: AdminMedia, confirmation: string) => post<void>(`/admin/media/${m.kind}/${m.id}/deletion`, { expectedUpdatedAt: m.updatedAt, confirmation }),
  audit: (q: string, page: number, signal?: AbortSignal) => api<AdminPageResult<AuditEntry>>(`/admin/audit-logs?${query({ q,page })}`, { signal }),
  maintenance: (signal?: AbortSignal) => api<MaintenanceSummary>('/admin/maintenance', { signal }),
  jobs: (signal?: AbortSignal) => api<MaintenanceJob[]>('/admin/maintenance/jobs', { signal }),
  enqueue: (kind: MaintenanceJob['kind'], confirmation: string) => post<MaintenanceJob>('/admin/maintenance/jobs', { kind, confirmation }),
}
