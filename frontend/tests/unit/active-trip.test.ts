import { describe, expect, it } from 'vitest'
import { resolveActiveTrip } from '@/lib/active-trip'

describe('当前旅行选择', () => {
  const trips = [{ id: 1, status: 'PLANNING' }, { id: 2, status: 'ARCHIVED' }]
  it('保留用户主动选择的归档旅行', () => expect(resolveActiveTrip(trips, 2)?.id).toBe(2))
  it('记忆值失效或属于其他账号时只从当前列表回退', () => expect(resolveActiveTrip(trips, 99)?.id).toBe(1))
  it('全部归档时使用首条，无旅行时返回空', () => {
    expect(resolveActiveTrip([trips[1]], null)?.id).toBe(2)
    expect(resolveActiveTrip([], 1)).toBeNull()
  })
})
