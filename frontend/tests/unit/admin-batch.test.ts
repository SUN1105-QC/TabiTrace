import { describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '@/services/admin'
import { ApiError } from '@/services/api'
import { patchedPermissions, writeUserBatch } from '@/utils/admin-batch'

const base: AdminUser = { id: 1, email: 'fixture@example.test', nickname: '测试旅人', role: 'USER', status: 'ACTIVE', userLevel: '基础用户', tripLimit: 20, tripRetentionMonths: 1, canShare: true, canVideo: true, customMusicAccess: 'INHERIT', trips: 0, photos: 0, createdAt: '2026-11-01T00:00:00', updatedAt: '2026-11-15T00:00:00.123456' }
describe('用户批量操作使用既有受保护接口', () => {
  it('只覆盖勾选字段，保留各账号的原权限、状态和完整微秒版本', () => {
    const user = { ...base, status: 'DISABLED' as const, customMusicAccess: 'DENY' as const, canShare: false }
    expect(patchedPermissions(user, { tripLimit: 30 })).toMatchObject({ status: 'DISABLED', customMusicAccess: 'DENY', canShare: false, tripLimit: 30, expectedUpdatedAt: base.updatedAt })
  })
  it('版本冲突只报告该用户失败，不把部分成功说成全部成功', async () => {
    const write = vi.fn().mockRejectedValueOnce(new ApiError('资料已变化',409)).mockResolvedValueOnce({ ...base, id: 2, tripLimit: 30 })
    const results = await writeUserBatch([base,{ ...base,id:2 }], { tripLimit:30 }, write)
    expect(results[0].error).toBe('资料已变化')
    expect(results[1].saved?.tripLimit).toBe(30)
    expect(write).toHaveBeenCalledTimes(2)
  })
  it.each([0,401,403,429])('连接 / 授权 / 限流错误 %s 后停止后续写入', async status => {
    const write = vi.fn().mockRejectedValue(new ApiError('暂不可操作',status))
    const results = await writeUserBatch([base,{ ...base,id:2 }], { status:'DISABLED' }, write)
    expect(write).toHaveBeenCalledTimes(1)
    expect(results[1].error).toContain('尚未执行')
  })
  it('管理员与注销中账号不会由前端发出权限修改请求', async () => {
    const write = vi.fn()
    const result = await writeUserBatch([{ ...base,role:'ADMIN' },{ ...base,id:2,status:'DELETION_PENDING' }], { canShare:false }, write)
    expect(result.every(item => !!item.error)).toBe(true)
    expect(write).not.toHaveBeenCalled()
  })
  it('空选择、重复用户、过大批次和空修改不会写入', async () => {
    const write = vi.fn()
    await expect(writeUserBatch([], { canVideo:false }, write)).rejects.toThrow('1～50')
    await expect(writeUserBatch([base,base], { canVideo:false }, write)).rejects.toThrow('重复')
    await expect(writeUserBatch(Array.from({length:51},(_,id)=>({ ...base,id })), { canVideo:false }, write)).rejects.toThrow('1～50')
    await expect(writeUserBatch([base], {}, write)).rejects.toThrow('至少勾选')
    expect(write).not.toHaveBeenCalled()
  })
  it('保留月数不合法时不会发出当前账号写入', async () => {
    const write = vi.fn()
    const result = await writeUserBatch([base], { tripRetentionMonths:0 }, write)
    expect(result[0].error).toContain('保留月数')
    expect(write).not.toHaveBeenCalled()
  })
})
