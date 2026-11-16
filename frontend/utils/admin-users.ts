import type { AdminUser, UserPermissionsInput } from '@/services/admin'

export type PermissionDraft = Omit<UserPermissionsInput, 'tripLimit' | 'tripRetentionMonths' | 'expectedUpdatedAt'> & {
  tripLimit: string
  tripRetentionMonths: string
}

export function permissionDraft(user: AdminUser): PermissionDraft {
  return {
    userLevel: user.userLevel,
    tripLimit: String(user.tripLimit),
    tripRetentionMonths: String(user.tripRetentionMonths),
    canShare: user.canShare,
    canVideo: user.canVideo,
    customMusicAccess: user.customMusicAccess,
    status: user.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  }
}

export function validatePermissions(draft: PermissionDraft): string {
  if (!draft.userLevel.trim() || draft.userLevel.trim().length > 40) return '请填写 1～40 字的用户等级名称。'
  if (!/^\d+$/.test(draft.tripLimit) || Number(draft.tripLimit) < 1 || Number(draft.tripLimit) > 100000) return '旅程上限须为 1～100000 的整数，0 不代表不限。'
  if (!/^\d+$/.test(draft.tripRetentionMonths) || Number(draft.tripRetentionMonths) < 1 || Number(draft.tripRetentionMonths) > 1200) return '保留月数须为 1～1200 的整数。'
  return ''
}

export function permissionsInput(draft: PermissionDraft, user: AdminUser): UserPermissionsInput {
  return { ...draft, userLevel: draft.userLevel.trim(), tripLimit: Number(draft.tripLimit), tripRetentionMonths: Number(draft.tripRetentionMonths), expectedUpdatedAt: user.updatedAt }
}

export function permissionRisks(draft: PermissionDraft, user: AdminUser): string[] {
  const risks: string[] = []
  if (Number(draft.tripRetentionMonths) < user.tripRetentionMonths) risks.push('缩短保留期限会重算未过期旅程的到期日，可能使已有旅程立即到期并进入自动清理。已过期数据不会恢复。')
  if (draft.status === 'DISABLED' && user.status !== 'DISABLED') risks.push('停用后将立即撤销该用户所有登录会话，用户将无法继续访问账号。已有视频任务沿用当前任务处理规则。')
  return risks
}

export function adminBytes(value: number): string {
  if (value < 1024) return `${value.toLocaleString('zh-CN')} B`
  const index = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][index]}`
}

export function adminStatus(status: AdminUser['status']): string {
  return { ACTIVE: '正常', DISABLED: '已停用', DELETION_PENDING: '注销冷静期' }[status]
}
