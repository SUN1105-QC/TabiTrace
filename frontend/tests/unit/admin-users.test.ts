import { describe, expect, it } from 'vitest'
import type { AdminUser } from '@/services/admin'
import { adminBytes, permissionDraft, permissionRisks, permissionsInput, validatePermissions } from '@/utils/admin-users'

const user: AdminUser = {
  id: 1, email: 'fixture@example.test', nickname: '测试旅人', role: 'USER', status: 'ACTIVE', userLevel: '基础用户',
  tripLimit: 20, tripRetentionMonths: 12, canShare: true, canVideo: true, customMusicAccess: 'INHERIT',
  trips: 5, photos: 0, createdAt: '2026-11-01T00:00:00', updatedAt: '2026-11-15T00:00:00.123456',
}
describe('管理端权限草稿与风险检查', () => {
  it('只提交允许修改的字段，并完整保留微秒并发令牌', () => {
    const input = permissionsInput({ ...permissionDraft(user), userLevel: ' 基础用户 ' }, user)
    expect(input.expectedUpdatedAt).toBe(user.updatedAt)
    expect(input).not.toHaveProperty('role')
    expect(input).not.toHaveProperty('email')
    expect(input.userLevel).toBe('基础用户')
    expect(validatePermissions(permissionDraft(user))).toBe('')
  })
  it.each(['', '0', '-1', '1.5', '100001', 'NaN', '1e3'])('拒绝非法配额 %s', value => {
    expect(validatePermissions({ ...permissionDraft(user), tripLimit: value })).toContain('旅程上限')
  })
  it.each(['', '0', '-1', '1.5', '1201'])('拒绝非法月数 %s', value => {
    expect(validatePermissions({ ...permissionDraft(user), tripRetentionMonths: value })).toContain('保留月数')
  })
  it('缩短月份与停用必须告知风险，减少配额不宣称删除数据', () => {
    expect(permissionRisks({ ...permissionDraft(user), tripRetentionMonths: '1', status: 'DISABLED' }, user)).toHaveLength(2)
    expect(permissionRisks({ ...permissionDraft(user), tripLimit: '1' }, user)).toEqual([])
    expect(permissionRisks(permissionDraft({ ...user, status: 'DISABLED' }), { ...user, status: 'DISABLED' })).toEqual([])
  })
  it('真实零字节与单位格式化', () => {
    expect(adminBytes(0)).toBe('0 B')
    expect(adminBytes(1024)).toBe('1.0 KB')
    expect(adminBytes(1024 ** 3)).toBe('1.0 GB')
  })
})
