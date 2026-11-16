import type { AdminUser, UserPermissionsInput } from '@/services/admin'
import { ApiError } from '@/services/api'
import { permissionDraft, permissionsInput, validatePermissions } from './admin-users'

export type PermissionPatch = Partial<Omit<UserPermissionsInput, 'expectedUpdatedAt'>>
export type UserWriteResult = { user: AdminUser; saved?: AdminUser; error?: string }

export function patchedPermissions(user: AdminUser, patch: PermissionPatch): UserPermissionsInput {
  if (user.role !== 'USER' || user.status === 'DELETION_PENDING') throw new Error('此账号当前不可修改。')
  const draft = { ...permissionDraft(user), ...patch,
    tripLimit: String(patch.tripLimit ?? user.tripLimit),
    tripRetentionMonths: String(patch.tripRetentionMonths ?? user.tripRetentionMonths) }
  const error = validatePermissions(draft)
  if (error) throw new Error(error)
  return permissionsInput(draft, user)
}

/** 逐项复用现有鉴权 / 审计 / 乐观锁接口。部分成功必须逐项报告，不能冒充一个原子事务。 */
export async function writeUserBatch(users: AdminUser[], patch: PermissionPatch,
  write: (id: number, input: UserPermissionsInput) => Promise<AdminUser>,
  progress: (completed: number) => void = () => undefined): Promise<UserWriteResult[]> {
  if (users.length < 1 || users.length > 50) throw new Error('每次请选择 1～50 个用户。')
  if (new Set(users.map(user => user.id)).size !== users.length) throw new Error('所选用户重复，请重新选择。')
  if (!Object.keys(patch).length) throw new Error('请至少勾选一项要修改的权限。')
  const results: UserWriteResult[] = []
  let stopped = ''
  for (const user of users) {
    if (stopped) results.push({ user, error: stopped })
    else {
      try { results.push({ user, saved: await write(user.id, patchedPermissions(user, patch)) }) }
      catch (error) {
        results.push({ user, error: error instanceof Error ? error.message : '修改未完成，请重试。' })
        if (error instanceof ApiError && [0,401,403,429].includes(error.status)) stopped = '前序请求遇到连接、鉴权或限流错误，此项尚未执行。'
      }
    }
    progress(results.length)
  }
  return results
}
